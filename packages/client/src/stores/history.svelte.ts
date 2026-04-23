import type { ClientToServer, ElementSelection } from "@konstner/core";

export type EntryKind = "prompt" | "extract";
export type EntryStatus = "loading" | "done" | "reverted";

export interface HistoryEntry {
  id: string;
  threadId: string;
  parentId?: string;
  kind: EntryKind;
  prompt: string;
  target: string;
  status: EntryStatus;
  summary?: string;
  selection: ElementSelection | null;
  path?: string;
}

interface ThreadMeta {
  reverting: boolean;
  confirming: boolean;
  continueOpen: boolean;
}

export interface ThreadView {
  root: HistoryEntry;
  turns: HistoryEntry[];
  busy: boolean;
  reverted: boolean;
  reverting: boolean;
  confirming: boolean;
  continueOpen: boolean;
}

export interface HistoryStoreDeps {
  send(msg: ClientToServer): void;
  idGen?: () => string;
}

export interface HistoryStore {
  readonly threads: ThreadView[];
  submit(args: { prompt: string; selection: ElementSelection | null; path: string }): void;
  extract(args: { selection: ElementSelection; name: string }): void;
  continueThread(parentId: string, prompt: string): void;
  handleResolved(msg: { id: string; summary: string }): void;
  handleReverted(msg: { threadId: string; files: string[] }): void;
  requestRevert(threadId: string): void;
  confirmRevert(threadId: string): void;
  cancelConfirm(threadId: string): void;
  openContinue(threadId: string): void;
  closeContinue(threadId: string): void;
}

function defaultIdGen(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function targetLabel(sel: ElementSelection): string {
  const tag = `<${sel.tagName}>`;
  return sel.loc ? `${tag} ${sel.loc.file}:${sel.loc.line}` : tag;
}

export function createHistoryStore(deps: HistoryStoreDeps): HistoryStore {
  const idGen = deps.idGen ?? defaultIdGen;
  // entries stored newest-first
  const entries = $state<HistoryEntry[]>([]);
  // per-thread UI flags stored as reactive object entries
  const threadMeta = $state<Record<string, ThreadMeta>>({});

  function getMeta(threadId: string): ThreadMeta {
    if (!threadMeta[threadId]) {
      threadMeta[threadId] = { reverting: false, confirming: false, continueOpen: false };
    }
    return threadMeta[threadId];
  }

  const threads: ThreadView[] = $derived.by(() => {
    const byThread = new Map<string, { root: HistoryEntry; turns: HistoryEntry[] }>();
    const order: string[] = [];
    // iterate oldest to newest so root is first encountered
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      let t = byThread.get(e.threadId);
      if (!t) {
        t = { root: e, turns: [] };
        byThread.set(e.threadId, t);
        order.push(e.threadId);
      }
      if (e.id === e.threadId) t.root = e;
      t.turns.push(e);
    }
    // order is filled oldest-thread-first (we iterated oldest entries first);
    // newest thread = last entry's threadId appears first in entries array
    // sort: thread whose first entry is at lowest index in entries[] is newest
    const sorted = order
      .map((id) => byThread.get(id)!)
      .sort((a, b) => {
        const ai = entries.findIndex((h) => h.threadId === a.root.threadId);
        const bi = entries.findIndex((h) => h.threadId === b.root.threadId);
        return ai - bi; // lower index = newer (entries are newest-first)
      });
    return sorted.map((t) => {
      const meta = threadMeta[t.root.threadId] ?? { reverting: false, confirming: false, continueOpen: false };
      return {
        root: t.root,
        turns: t.turns,
        busy: t.turns.some((x) => x.status === "loading"),
        reverted: t.turns.every((x) => x.status === "reverted"),
        reverting: meta.reverting,
        confirming: meta.confirming,
        continueOpen: meta.continueOpen,
      };
    });
  });

  function unshift(entry: HistoryEntry) {
    entries.unshift(entry);
  }

  function findEntry(id: string): HistoryEntry | undefined {
    return entries.find((e) => e.id === id);
  }

  function targetOf(sel: ElementSelection | null, path?: string): string {
    return sel ? targetLabel(sel) : `page ${path ?? "/"}`;
  }

  return {
    get threads() {
      return threads;
    },
    submit({ prompt, selection, path }) {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      const id = idGen();
      deps.send({
        type: "request_change",
        id,
        selection,
        prompt: trimmed,
        path,
      });
      unshift({
        id,
        threadId: id,
        kind: "prompt",
        prompt: trimmed,
        target: targetOf(selection, path),
        status: "loading",
        selection,
        path,
      });
    },
    extract({ selection, name }) {
      const id = idGen();
      deps.send({
        type: "request_extract",
        id,
        selection: [selection],
        suggestedName: name,
      });
      unshift({
        id,
        threadId: id,
        kind: "extract",
        prompt: `Extract → ${name}`,
        target: targetLabel(selection),
        status: "loading",
        selection,
      });
    },
    continueThread(parentId, prompt) {
      const parent = findEntry(parentId);
      if (!parent) return;
      const id = idGen();
      deps.send({ type: "request_continue", id, parentId, prompt });
      unshift({
        id,
        threadId: parent.threadId,
        parentId: parent.id,
        kind: "prompt",
        prompt,
        target: parent.target,
        status: "loading",
        selection: parent.selection,
        path: parent.path,
      });
      getMeta(parent.threadId).continueOpen = false;
    },
    handleResolved({ id, summary }) {
      const e = findEntry(id);
      if (!e) return;
      e.status = "done";
      e.summary = summary;
    },
    handleReverted({ threadId }) {
      for (const e of entries) {
        if (e.threadId === threadId) e.status = "reverted";
      }
      getMeta(threadId).reverting = false;
    },
    requestRevert(threadId) {
      getMeta(threadId).confirming = false;
      getMeta(threadId).reverting = true;
      deps.send({ type: "request_revert", threadId });
      setTimeout(() => {
        getMeta(threadId).reverting = false;
      }, 10000);
    },
    confirmRevert(threadId) {
      getMeta(threadId).confirming = true;
      setTimeout(() => {
        getMeta(threadId).confirming = false;
      }, 3000);
    },
    cancelConfirm(threadId) {
      getMeta(threadId).confirming = false;
    },
    openContinue(threadId) {
      getMeta(threadId).continueOpen = true;
    },
    closeContinue(threadId) {
      getMeta(threadId).continueOpen = false;
    },
  };
}
