# Overlay Svelte Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the imperative 816-line `packages/client/src/overlay.ts` with a Svelte 5 component tree mounted into the shadow root, backed by runes-based stores, while preserving the public `mountOverlay({ port })` contract.

**Architecture:** The existing `mountOverlay()` keeps its signature. Internally it creates the shadow host + root (as today), constructs runes-backed stores, opens the websocket, constructs the `Picker`, and calls Svelte's `mount(App, { target: shadow, props: { ctx } })`. `App.svelte` installs a context bag (`AppContext`) via `setContext`, then renders `<Fab>`, `<Panel>`, `<History>`, `<ScanResults>`, `<Outlines>`, `<Toasts>`. Stores live in `packages/client/src/stores/*.svelte.ts` and are plain modules — unit-testable without a DOM. Picker stays imperative but writes to `hoverStore` / `selectionStore`.

**Tech Stack:** Svelte 5 (runes, `mount()` API), Vitest, @testing-library/svelte, happy-dom (already configured for the `packages/client/**` glob). TypeScript.

**Reference spec:** `docs/superpowers/specs/2026-04-23-overlay-svelte-rewrite-design.md`

---

## File layout

**New files:**

```
packages/client/src/stores/
  context.ts                 # AppContext type + context key helpers
  toasts.svelte.ts           # Toast queue
  selection.svelte.ts        # Current element selection + DOM resolution
  history.svelte.ts          # Requests + threads + revert/continue flags
  panel.svelte.ts            # Panel open flag, extract form open flag
  scan.svelte.ts             # Scan result + visibility
  toasts.test.ts
  selection.test.ts
  history.test.ts
  panel.test.ts
  scan.test.ts

packages/client/src/ui/
  tokens.css.ts              # Shared CSS custom properties (exported as string)
  App.svelte
  Fab.svelte
  Panel.svelte
  ExtractForm.svelte
  History.svelte
  Thread.svelte
  ContinueForm.svelte
  ScanResults.svelte
  Outlines.svelte
  Toasts.svelte
  App.test.ts
  History.test.ts
  Panel.test.ts
```

**Modified files:**

- `packages/client/src/overlay.ts` — rewritten; drops from 816 lines to ~90 lines. Responsible only for: create shadow host, construct stores, open ws, construct picker, wire ws→stores, `mount(App, …)`, return destroy handle.
- `packages/client/src/KonstnerShell.svelte` — unchanged behavior, but stays as the canonical Svelte entry. No code change needed.
- `packages/client/package.json` — `svelte` moves from `peerDependencies` to `dependencies`; add `@testing-library/svelte`, `@testing-library/jest-dom`, `@sveltejs/vite-plugin-svelte` (for tests), `@vitest/browser` not needed.
- `vitest.config.ts` (root) — add Svelte plugin for `.svelte` test imports.

**Deleted surfaces (inside `overlay.ts` only):** `STYLES` constant, `renderHistory`, `renderPanel`, `openExtractForm`, `runPageScan`, `renderScanResults`, `drawSelectedBox`, `stepUp`, `sendContinue`, `sendExtract`, `submit`, `toast`, `findByLoc`, `findNextAnnotatedAncestor`, `defaultComponentName`, `targetLabel`, `groupThreads` and the `HistoryEntry` / `ThreadView` interfaces — all move into stores or components.

---

## Task 1: Dependencies and Vitest/Svelte plumbing

**Files:**
- Modify: `packages/client/package.json`
- Modify: `vitest.config.ts` (root)
- Modify: `packages/client/tsconfig.json` (if present — check)

- [ ] **Step 1.1: Inspect current tsconfig**

Run: `cat packages/client/tsconfig.json`

Verify it extends `tsconfig.base.json`. No change expected; recorded for context.

- [ ] **Step 1.2: Update `packages/client/package.json`**

Replace the file with:

```json
{
  "name": "@konstner/client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "svelte": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "svelte": "./src/index.ts",
      "import": "./dist/index.js"
    },
    "./auto": {
      "types": "./dist/auto.d.ts",
      "development": "./src/auto.ts",
      "import": "./dist/auto.js"
    },
    "./KonstnerShell.svelte": "./src/KonstnerShell.svelte",
    "./dist/*": "./dist/*"
  },
  "files": ["dist", "src"],
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "dependencies": {
    "@konstner/core": "workspace:*",
    "svelte": "^5.0.0"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/svelte": "^5.2.0",
    "typescript": "^5.6.0"
  }
}
```

Note: `svelte` moved from `peerDependencies` to `dependencies`. `peerDependencies` / `peerDependenciesMeta` removed. Dev deps added for component testing.

- [ ] **Step 1.3: Update root `vitest.config.ts`**

Replace with:

```ts
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: "node",
    include: ["packages/*/src/**/*.test.ts"],
    environmentMatchGlobs: [["packages/client/src/**", "happy-dom"]],
    setupFiles: ["./packages/client/test-setup.ts"],
  },
});
```

- [ ] **Step 1.4: Create test setup file**

Create `packages/client/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 1.5: Install**

Run: `pnpm install`

Expected: success; `svelte` listed in `@konstner/client` dependencies; new devDeps installed.

- [ ] **Step 1.6: Verify existing tests still pass**

Run: `pnpm test`

Expected: all existing tests (`protocol.test.ts`, `verify.test.ts`, `edits.test.ts`, `state.test.ts`) pass. No client tests exist yet.

- [ ] **Step 1.7: Commit**

```bash
git add packages/client/package.json vitest.config.ts packages/client/test-setup.ts pnpm-lock.yaml
git commit -m "client: add svelte runtime + testing-library for overlay rewrite"
```

---

## Task 2: Toasts store

Simplest store — start here to validate the plumbing.

**Files:**
- Create: `packages/client/src/stores/toasts.svelte.ts`
- Create: `packages/client/src/stores/toasts.test.ts`

- [ ] **Step 2.1: Write failing test**

Create `packages/client/src/stores/toasts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createToastsStore } from "./toasts.svelte.js";

describe("toasts store", () => {
  it("push adds a toast with a unique id", () => {
    const s = createToastsStore();
    s.push("info", "hello");
    s.push("error", "bad");
    expect(s.items.length).toBe(2);
    expect(s.items[0].message).toBe("hello");
    expect(s.items[0].level).toBe("info");
    expect(s.items[1].level).toBe("error");
    expect(s.items[0].id).not.toBe(s.items[1].id);
  });

  it("dismiss removes a toast by id", () => {
    const s = createToastsStore();
    s.push("info", "a");
    s.push("info", "b");
    const firstId = s.items[0].id;
    s.dismiss(firstId);
    expect(s.items.length).toBe(1);
    expect(s.items[0].message).toBe("b");
  });
});
```

- [ ] **Step 2.2: Verify it fails**

Run: `pnpm vitest run packages/client/src/stores/toasts.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 2.3: Implement**

Create `packages/client/src/stores/toasts.svelte.ts`:

```ts
export type ToastLevel = "info" | "success" | "error";

export interface Toast {
  id: string;
  level: ToastLevel;
  message: string;
}

export interface ToastsStore {
  readonly items: Toast[];
  push(level: ToastLevel, message: string): string;
  dismiss(id: string): void;
}

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `t_${Date.now().toString(36)}_${nextId}`;
}

export function createToastsStore(): ToastsStore {
  const items = $state<Toast[]>([]);
  return {
    get items() {
      return items;
    },
    push(level, message) {
      const id = makeId();
      items.push({ id, level, message });
      return id;
    },
    dismiss(id) {
      const idx = items.findIndex((t) => t.id === id);
      if (idx >= 0) items.splice(idx, 1);
    },
  };
}
```

- [ ] **Step 2.4: Verify it passes**

Run: `pnpm vitest run packages/client/src/stores/toasts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 2.5: Commit**

```bash
git add packages/client/src/stores/toasts.svelte.ts packages/client/src/stores/toasts.test.ts
git commit -m "client/stores: add toasts store with push/dismiss"
```

---

## Task 3: Selection store

Owns `currentSelection`, the derived `element` (looked up by `kLocId`), and publishes changes over ws.

**Files:**
- Create: `packages/client/src/stores/selection.svelte.ts`
- Create: `packages/client/src/stores/selection.test.ts`

- [ ] **Step 3.1: Write failing test**

Create `packages/client/src/stores/selection.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { ElementSelection } from "@konstner/core";
import { createSelectionStore } from "./selection.svelte.js";

function makeSel(kLocId: string, tag = "div"): ElementSelection {
  return {
    kLocId,
    loc: { file: "App.svelte", line: 1, col: 0 },
    tagName: tag,
    outerHTML: `<${tag}></${tag}>`,
    computedStyles: {},
    ancestors: [],
  };
}

describe("selection store", () => {
  it("setFromPicker stores the selection and publishes to ws", () => {
    const send = vi.fn();
    const s = createSelectionStore({ send });
    const sel = makeSel("k1");
    s.setFromPicker(sel);
    expect(s.current).toEqual(sel);
    expect(send).toHaveBeenCalledWith({ type: "selection_changed", selection: sel });
  });

  it("clear nulls the selection and publishes null", () => {
    const send = vi.fn();
    const s = createSelectionStore({ send });
    s.setFromPicker(makeSel("k1"));
    s.clear();
    expect(s.current).toBeNull();
    expect(send).toHaveBeenLastCalledWith({ type: "selection_changed", selection: null });
  });

  it("resolveElement uses document.querySelector by data-k-loc", () => {
    document.body.innerHTML = `<div data-k-loc="xyz">x</div>`;
    const s = createSelectionStore({ send: vi.fn() });
    s.setFromPicker(makeSel("xyz"));
    expect(s.element?.getAttribute("data-k-loc")).toBe("xyz");
  });

  it("element is null when kLocId is empty", () => {
    const s = createSelectionStore({ send: vi.fn() });
    s.setFromPicker(makeSel(""));
    expect(s.element).toBeNull();
  });
});
```

- [ ] **Step 3.2: Verify it fails**

Run: `pnpm vitest run packages/client/src/stores/selection.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3.3: Implement**

Create `packages/client/src/stores/selection.svelte.ts`:

```ts
import type { ClientToServer, ElementSelection } from "@konstner/core";

export interface SelectionStoreDeps {
  send(msg: ClientToServer): void;
}

export interface SelectionStore {
  readonly current: ElementSelection | null;
  readonly element: HTMLElement | null;
  setFromPicker(sel: ElementSelection): void;
  setWithoutPublishing(sel: ElementSelection | null): void;
  clear(): void;
}

function findByLoc(kLocId: string): HTMLElement | null {
  if (!kLocId) return null;
  return document.querySelector<HTMLElement>(
    `[data-k-loc="${CSS.escape(kLocId)}"]`,
  );
}

export function createSelectionStore(deps: SelectionStoreDeps): SelectionStore {
  let current = $state<ElementSelection | null>(null);
  const element = $derived(current ? findByLoc(current.kLocId) : null);

  return {
    get current() {
      return current;
    },
    get element() {
      return element;
    },
    setFromPicker(sel) {
      current = sel;
      deps.send({ type: "selection_changed", selection: sel });
    },
    setWithoutPublishing(sel) {
      current = sel;
    },
    clear() {
      current = null;
      deps.send({ type: "selection_changed", selection: null });
    },
  };
}

export function findNextAnnotatedAncestor(
  el: HTMLElement | null,
): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    if (node.getAttribute("data-k-loc")) return node;
    node = node.parentElement;
  }
  return null;
}
```

Note: `setWithoutPublishing` is used by step-up (which will publish through its own code path after `describe()`).

- [ ] **Step 3.4: Verify it passes**

Run: `pnpm vitest run packages/client/src/stores/selection.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 3.5: Commit**

```bash
git add packages/client/src/stores/selection.svelte.ts packages/client/src/stores/selection.test.ts
git commit -m "client/stores: add selection store with DOM resolution and ws publishing"
```

---

## Task 4: History store

The most complex store — owns history entries, grouping into threads, and the per-thread flags for continue/revert state.

**Files:**
- Create: `packages/client/src/stores/history.svelte.ts`
- Create: `packages/client/src/stores/history.test.ts`

- [ ] **Step 4.1: Write failing test**

Create `packages/client/src/stores/history.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { ElementSelection } from "@konstner/core";
import { createHistoryStore } from "./history.svelte.js";

function makeSel(kLocId = "k1"): ElementSelection {
  return {
    kLocId,
    loc: { file: "App.svelte", line: 10, col: 2 },
    tagName: "button",
    outerHTML: "<button></button>",
    computedStyles: {},
    ancestors: [],
  };
}

describe("history store", () => {
  it("submit adds a loading prompt entry and sends request_change", () => {
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    const sel = makeSel();
    s.submit({ prompt: "make it red", selection: sel, path: "/" });
    expect(send).toHaveBeenCalledWith({
      type: "request_change",
      id: "req_1",
      selection: sel,
      prompt: "make it red",
      path: "/",
    });
    expect(s.threads).toHaveLength(1);
    const t = s.threads[0];
    expect(t.root.status).toBe("loading");
    expect(t.root.prompt).toBe("make it red");
    expect(t.busy).toBe(true);
  });

  it("extract adds a loading extract entry and sends request_extract", () => {
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_2" });
    const sel = makeSel();
    s.extract({ selection: sel, name: "Card" });
    expect(send).toHaveBeenCalledWith({
      type: "request_extract",
      id: "req_2",
      selection: [sel],
      suggestedName: "Card",
    });
    expect(s.threads[0].root.kind).toBe("extract");
    expect(s.threads[0].root.prompt).toBe("Extract → Card");
  });

  it("handleResolved flips loading → done and records summary", () => {
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    s.submit({ prompt: "p", selection: null, path: "/" });
    s.handleResolved({ id: "req_1", summary: "all good" });
    expect(s.threads[0].root.status).toBe("done");
    expect(s.threads[0].root.summary).toBe("all good");
  });

  it("continue adds a follow-up turn on the same thread", () => {
    const send = vi.fn();
    let n = 0;
    const s = createHistoryStore({ send, idGen: () => `req_${++n}` });
    s.submit({ prompt: "first", selection: null, path: "/" });
    const parentId = s.threads[0].root.id;
    s.continueThread(parentId, "second");
    expect(send).toHaveBeenLastCalledWith({
      type: "request_continue",
      id: "req_2",
      parentId,
      prompt: "second",
    });
    expect(s.threads).toHaveLength(1);
    expect(s.threads[0].turns).toHaveLength(2);
    expect(s.threads[0].turns[1].prompt).toBe("second");
  });

  it("requestRevert sets reverting flag, times out after 10s", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    s.submit({ prompt: "p", selection: null, path: "/" });
    s.handleResolved({ id: "req_1", summary: "ok" });
    const tid = s.threads[0].root.threadId;
    s.requestRevert(tid);
    expect(s.threads[0].reverting).toBe(true);
    expect(send).toHaveBeenLastCalledWith({ type: "request_revert", threadId: tid });
    vi.advanceTimersByTime(10001);
    expect(s.threads[0].reverting).toBe(false);
    vi.useRealTimers();
  });

  it("handleReverted marks every entry in the thread as reverted", () => {
    const send = vi.fn();
    let n = 0;
    const s = createHistoryStore({ send, idGen: () => `req_${++n}` });
    s.submit({ prompt: "first", selection: null, path: "/" });
    s.continueThread(s.threads[0].root.id, "second");
    const tid = s.threads[0].root.threadId;
    s.handleReverted({ threadId: tid, files: ["a.svelte"] });
    for (const turn of s.threads[0].turns) {
      expect(turn.status).toBe("reverted");
    }
    expect(s.threads[0].reverted).toBe(true);
  });

  it("confirmRevert toggles on then off after 3s", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    s.submit({ prompt: "p", selection: null, path: "/" });
    s.handleResolved({ id: "req_1", summary: "ok" });
    const tid = s.threads[0].root.threadId;
    s.confirmRevert(tid);
    expect(s.threads[0].confirming).toBe(true);
    vi.advanceTimersByTime(3001);
    expect(s.threads[0].confirming).toBe(false);
    vi.useRealTimers();
  });

  it("openContinue / closeContinue flag on a thread", () => {
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    s.submit({ prompt: "p", selection: null, path: "/" });
    const tid = s.threads[0].root.threadId;
    s.openContinue(tid);
    expect(s.threads[0].continueOpen).toBe(true);
    s.closeContinue(tid);
    expect(s.threads[0].continueOpen).toBe(false);
  });

  it("threads are ordered newest first", () => {
    const send = vi.fn();
    let n = 0;
    const s = createHistoryStore({ send, idGen: () => `req_${++n}` });
    s.submit({ prompt: "first", selection: null, path: "/" });
    s.submit({ prompt: "second", selection: null, path: "/" });
    expect(s.threads[0].root.prompt).toBe("second");
    expect(s.threads[1].root.prompt).toBe("first");
  });
});
```

- [ ] **Step 4.2: Verify it fails**

Run: `pnpm vitest run packages/client/src/stores/history.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 4.3: Implement**

Create `packages/client/src/stores/history.svelte.ts`:

```ts
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
  const entries = $state<HistoryEntry[]>([]); // newest-first
  const confirmSet = $state<Set<string>>(new Set());
  const revertingSet = $state<Set<string>>(new Set());
  const openContinueSet = $state<Set<string>>(new Set());

  const threads: ThreadView[] = $derived.by(() => {
    const byThread = new Map<string, { root: HistoryEntry; turns: HistoryEntry[] }>();
    const order: string[] = [];
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
    // Newest thread first (most recent turn in `entries` wins).
    const sorted = order
      .map((id) => byThread.get(id)!)
      .sort((a, b) => {
        const ai = entries.findIndex((h) => h.threadId === a.root.threadId);
        const bi = entries.findIndex((h) => h.threadId === b.root.threadId);
        return ai - bi;
      });
    return sorted.map((t) => ({
      root: t.root,
      turns: t.turns,
      busy: t.turns.some((x) => x.status === "loading"),
      reverted: t.turns.some((x) => x.status === "reverted"),
      reverting: revertingSet.has(t.root.threadId),
      confirming: confirmSet.has(t.root.threadId),
      continueOpen: openContinueSet.has(t.root.threadId),
    }));
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
      openContinueSet.delete(parent.threadId);
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
      revertingSet.delete(threadId);
    },
    requestRevert(threadId) {
      confirmSet.delete(threadId);
      revertingSet.add(threadId);
      deps.send({ type: "request_revert", threadId });
      setTimeout(() => {
        revertingSet.delete(threadId);
      }, 10000);
    },
    confirmRevert(threadId) {
      confirmSet.add(threadId);
      setTimeout(() => {
        confirmSet.delete(threadId);
      }, 3000);
    },
    cancelConfirm(threadId) {
      confirmSet.delete(threadId);
    },
    openContinue(threadId) {
      openContinueSet.add(threadId);
    },
    closeContinue(threadId) {
      openContinueSet.delete(threadId);
    },
  };
}
```

- [ ] **Step 4.4: Verify it passes**

Run: `pnpm vitest run packages/client/src/stores/history.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 4.5: Commit**

```bash
git add packages/client/src/stores/history.svelte.ts packages/client/src/stores/history.test.ts
git commit -m "client/stores: add history store with threads, continue, revert"
```

---

## Task 5: Panel store

Tracks panel-open and extract-form-open flags. Tiny.

**Files:**
- Create: `packages/client/src/stores/panel.svelte.ts`
- Create: `packages/client/src/stores/panel.test.ts`

- [ ] **Step 5.1: Write failing test**

Create `packages/client/src/stores/panel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createPanelStore } from "./panel.svelte.js";

describe("panel store", () => {
  it("toggle flips open", () => {
    const s = createPanelStore();
    expect(s.open).toBe(false);
    s.toggle();
    expect(s.open).toBe(true);
    s.toggle();
    expect(s.open).toBe(false);
  });

  it("openExtract / closeExtract flag", () => {
    const s = createPanelStore();
    s.openExtract();
    expect(s.extractOpen).toBe(true);
    s.closeExtract();
    expect(s.extractOpen).toBe(false);
  });
});
```

- [ ] **Step 5.2: Verify fail**

Run: `pnpm vitest run packages/client/src/stores/panel.test.ts`
Expected: FAIL.

- [ ] **Step 5.3: Implement**

Create `packages/client/src/stores/panel.svelte.ts`:

```ts
export interface PanelStore {
  readonly open: boolean;
  readonly extractOpen: boolean;
  toggle(): void;
  setOpen(v: boolean): void;
  openExtract(): void;
  closeExtract(): void;
}

export function createPanelStore(): PanelStore {
  let open = $state(false);
  let extractOpen = $state(false);
  return {
    get open() {
      return open;
    },
    get extractOpen() {
      return extractOpen;
    },
    toggle() {
      open = !open;
      if (!open) extractOpen = false;
    },
    setOpen(v) {
      open = v;
      if (!open) extractOpen = false;
    },
    openExtract() {
      extractOpen = true;
    },
    closeExtract() {
      extractOpen = false;
    },
  };
}
```

- [ ] **Step 5.4: Verify pass**

Run: `pnpm vitest run packages/client/src/stores/panel.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5.5: Commit**

```bash
git add packages/client/src/stores/panel.svelte.ts packages/client/src/stores/panel.test.ts
git commit -m "client/stores: add panel store"
```

---

## Task 6: Scan store

Owns the scan result + visibility and wraps the pure `scanPage()` function.

**Files:**
- Create: `packages/client/src/stores/scan.svelte.ts`
- Create: `packages/client/src/stores/scan.test.ts`

- [ ] **Step 6.1: Write failing test**

Create `packages/client/src/stores/scan.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { ScanResult } from "../scan.ts";
import { createScanStore } from "./scan.svelte.js";

const EMPTY_RESULT: ScanResult = {
  findings: [],
  stats: {
    elementsScanned: 0,
    headings: [],
    fontFamilies: new Map(),
    centeredElements: 0,
  },
};

describe("scan store", () => {
  it("run uses injected scanner, stores result, sends scan_page, sets visible", () => {
    const send = vi.fn();
    const scanner = vi.fn(() => EMPTY_RESULT);
    const s = createScanStore({ send, scanner, idGen: () => "scan_1" });
    s.run();
    expect(scanner).toHaveBeenCalled();
    expect(s.result).toBe(EMPTY_RESULT);
    expect(s.visible).toBe(true);
    expect(send).toHaveBeenCalledWith({
      type: "scan_page",
      id: "scan_1",
      findings: [],
    });
  });

  it("close hides without clearing", () => {
    const send = vi.fn();
    const s = createScanStore({ send, scanner: () => EMPTY_RESULT });
    s.run();
    s.close();
    expect(s.visible).toBe(false);
    expect(s.result).toBe(EMPTY_RESULT);
  });
});
```

- [ ] **Step 6.2: Verify fail**

Run: `pnpm vitest run packages/client/src/stores/scan.test.ts`
Expected: FAIL.

- [ ] **Step 6.3: Implement**

Create `packages/client/src/stores/scan.svelte.ts`:

```ts
import type { ClientToServer } from "@konstner/core";
import { scanPage, type ScanResult } from "../scan.js";

export interface ScanStoreDeps {
  send(msg: ClientToServer): void;
  scanner?: () => ScanResult;
  idGen?: () => string;
}

export interface ScanStore {
  readonly result: ScanResult | null;
  readonly visible: boolean;
  run(): void;
  close(): void;
}

function defaultIdGen(): string {
  return `scan_${Date.now().toString(36)}`;
}

export function createScanStore(deps: ScanStoreDeps): ScanStore {
  const idGen = deps.idGen ?? defaultIdGen;
  const scanner = deps.scanner ?? scanPage;
  let result = $state<ScanResult | null>(null);
  let visible = $state(false);
  return {
    get result() {
      return result;
    },
    get visible() {
      return visible;
    },
    run() {
      const r = scanner();
      result = r;
      visible = true;
      deps.send({ type: "scan_page", id: idGen(), findings: r.findings });
    },
    close() {
      visible = false;
    },
  };
}
```

- [ ] **Step 6.4: Verify pass**

Run: `pnpm vitest run packages/client/src/stores/scan.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6.5: Commit**

```bash
git add packages/client/src/stores/scan.svelte.ts packages/client/src/stores/scan.test.ts
git commit -m "client/stores: add scan store wrapping pure scanPage()"
```

---

## Task 7: AppContext + hover store

The hover store is tiny (just a writable `HTMLElement | null`). The `AppContext` is the bag the App hands to children via `setContext`.

**Files:**
- Create: `packages/client/src/stores/hover.svelte.ts`
- Create: `packages/client/src/stores/context.ts`

- [ ] **Step 7.1: Implement hover store (trivial, skip test)**

Create `packages/client/src/stores/hover.svelte.ts`:

```ts
export interface HoverStore {
  readonly target: HTMLElement | null;
  set(el: HTMLElement | null): void;
}

export function createHoverStore(): HoverStore {
  let target = $state<HTMLElement | null>(null);
  return {
    get target() {
      return target;
    },
    set(el) {
      target = el;
    },
  };
}
```

- [ ] **Step 7.2: Implement context module**

Create `packages/client/src/stores/context.ts`:

```ts
import { getContext, setContext } from "svelte";
import type { Picker } from "../picker.js";
import type { WsClient } from "../ws.js";
import type { HistoryStore } from "./history.svelte.js";
import type { HoverStore } from "./hover.svelte.js";
import type { PanelStore } from "./panel.svelte.js";
import type { ScanStore } from "./scan.svelte.js";
import type { SelectionStore } from "./selection.svelte.js";
import type { ToastsStore } from "./toasts.svelte.js";

export interface AppContext {
  ws: WsClient;
  picker: Picker;
  selection: SelectionStore;
  hover: HoverStore;
  history: HistoryStore;
  panel: PanelStore;
  scan: ScanStore;
  toasts: ToastsStore;
}

const KEY = Symbol("konstner.app");

export function provideAppContext(ctx: AppContext): void {
  setContext(KEY, ctx);
}

export function useAppContext(): AppContext {
  const ctx = getContext<AppContext>(KEY);
  if (!ctx) throw new Error("konstner AppContext not provided");
  return ctx;
}
```

- [ ] **Step 7.3: Typecheck**

Run: `pnpm --filter @konstner/client typecheck`
Expected: success (new files compile). If errors referencing unwritten files appear, ignore — those are resolved when components are added.

- [ ] **Step 7.4: Commit**

```bash
git add packages/client/src/stores/hover.svelte.ts packages/client/src/stores/context.ts
git commit -m "client/stores: add hover store and AppContext"
```

---

## Task 8: Design tokens module

Extracts shared colors/z-indices. Consumed as CSS custom properties on `:host`.

**Files:**
- Create: `packages/client/src/ui/tokens.css.ts`

- [ ] **Step 8.1: Implement**

Create `packages/client/src/ui/tokens.css.ts`:

```ts
// Top-level CSS for the shadow root. Injected once by App.svelte's <svelte:head>
// is not available inside a shadow root — App mounts a <style> element manually
// with this string.
export const ROOT_CSS = `
:host { all: initial;
  --k-z: 2147483647;
  --k-z-outline: 2147483646;
  --k-bg: #0b0b0f;
  --k-surface: #111;
  --k-fg: #eee;
  --k-muted: #9aa;
  --k-border: #222;
  --k-border-soft: #1a1a22;
  --k-accent: #2563eb;
  --k-accent-fg: #fff;
  --k-success: #22c55e;
  --k-warn: #f59e0b;
  --k-err: #ef4444;
  --k-hist-border: #1f2937;
  --k-blue-text: #93c5fd;
  --k-font: ui-sans-serif, system-ui, sans-serif;
  --k-mono: ui-monospace, monospace;
}
* { box-sizing: border-box; font-family: var(--k-font); }
@keyframes k-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
`;
```

- [ ] **Step 8.2: Commit**

```bash
git add packages/client/src/ui/tokens.css.ts
git commit -m "client/ui: add CSS tokens module for shadow root"
```

---

## Task 9: Toasts component

Simplest component — grounds the Svelte-in-shadow-root pipeline.

**Files:**
- Create: `packages/client/src/ui/Toasts.svelte`

- [ ] **Step 9.1: Implement**

Create `packages/client/src/ui/Toasts.svelte`:

```svelte
<script lang="ts">
  import { useAppContext } from "../stores/context.js";
  const { toasts } = useAppContext();

  $effect(() => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    for (const t of toasts.items) {
      if (timers.has(t.id)) continue;
      const h = setTimeout(() => toasts.dismiss(t.id), 4000);
      timers.set(t.id, h);
    }
    return () => {
      for (const h of timers.values()) clearTimeout(h);
    };
  });
</script>

{#each toasts.items as t (t.id)}
  <div class="toast {t.level}" role="status">{t.message}</div>
{/each}

<style>
  .toast {
    position: fixed;
    right: 16px;
    bottom: 130px;
    z-index: var(--k-z);
    background: var(--k-surface);
    color: #fff;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #333;
    font-size: 12px;
    max-width: 360px;
  }
  .toast.success { border-color: var(--k-success); }
  .toast.error { border-color: var(--k-err); }
</style>
```

- [ ] **Step 9.2: Typecheck**

Run: `pnpm --filter @konstner/client typecheck`
Expected: success.

- [ ] **Step 9.3: Commit**

```bash
git add packages/client/src/ui/Toasts.svelte
git commit -m "client/ui: add Toasts component"
```

---

## Task 10: Outlines component

Reactive replacement for `drawSelectedBox()` and the imperative hoverBox positioning. Subscribes to `hover.target` and `selection.element`, repositions on scroll/resize.

**Files:**
- Create: `packages/client/src/ui/Outlines.svelte`

- [ ] **Step 10.1: Implement**

Create `packages/client/src/ui/Outlines.svelte`:

```svelte
<script lang="ts">
  import { useAppContext } from "../stores/context.js";
  const { hover, selection } = useAppContext();

  let hoverRect = $state<DOMRect | null>(null);
  let selectedRect = $state<DOMRect | null>(null);

  function recompute() {
    hoverRect = hover.target ? hover.target.getBoundingClientRect() : null;
    selectedRect = selection.element
      ? selection.element.getBoundingClientRect()
      : null;
  }

  $effect(() => {
    // Track reactive deps then recompute.
    void hover.target;
    void selection.element;
    recompute();
  });

  $effect(() => {
    const onScroll = () => recompute();
    const onResize = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  });
</script>

{#if hoverRect}
  <div
    class="outline"
    style:top="{hoverRect.top}px"
    style:left="{hoverRect.left}px"
    style:width="{hoverRect.width}px"
    style:height="{hoverRect.height}px"
  ></div>
{/if}
{#if selectedRect}
  <div
    class="outline selected"
    style:top="{selectedRect.top}px"
    style:left="{selectedRect.left}px"
    style:width="{selectedRect.width}px"
    style:height="{selectedRect.height}px"
  ></div>
{/if}

<style>
  .outline {
    position: fixed;
    pointer-events: none;
    z-index: var(--k-z-outline);
    border: 2px solid var(--k-accent);
    background: rgba(37, 99, 235, 0.08);
    transition: all 50ms linear;
  }
  .outline.selected {
    border-color: var(--k-success);
    background: rgba(34, 197, 94, 0.08);
  }
</style>
```

- [ ] **Step 10.2: Commit**

```bash
git add packages/client/src/ui/Outlines.svelte
git commit -m "client/ui: add Outlines component for hover/selected boxes"
```

---

## Task 11: Fab component

**Files:**
- Create: `packages/client/src/ui/Fab.svelte`

- [ ] **Step 11.1: Implement**

Create `packages/client/src/ui/Fab.svelte`:

```svelte
<script lang="ts">
  import { useAppContext } from "../stores/context.js";
  const { panel, picker } = useAppContext();

  function onClick() {
    panel.toggle();
    if (panel.open) picker.start();
    else picker.stop();
  }
</script>

<button
  class="fab"
  class:active={panel.open}
  onclick={onClick}
  title="Konstner (pick element)"
  aria-label="Toggle Konstner"
>K</button>

<style>
  .fab {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: var(--k-z);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: var(--k-surface);
    color: #fff;
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }
  .fab.active { background: var(--k-accent); }
</style>
```

- [ ] **Step 11.2: Commit**

```bash
git add packages/client/src/ui/Fab.svelte
git commit -m "client/ui: add Fab component"
```

---

## Task 12: ScanResults component

**Files:**
- Create: `packages/client/src/ui/ScanResults.svelte`

- [ ] **Step 12.1: Implement**

Create `packages/client/src/ui/ScanResults.svelte`:

```svelte
<script lang="ts">
  import { useAppContext } from "../stores/context.js";
  const { scan } = useAppContext();

  const topFonts = $derived(() => {
    if (!scan.result) return "";
    return Array.from(scan.result.stats.fontFamilies.entries())
      .slice(0, 3)
      .map(([f, c]) => `${f} (${c})`)
      .join(", ") || "none";
  });

  const headingSummary = $derived(() => {
    if (!scan.result) return "";
    const hs = scan.result.stats.headings;
    return hs.length > 0
      ? `Headings: ${hs.map((h) => `h${h.level}`).join(", ")}`
      : "No headings found";
  });
</script>

{#if scan.visible && scan.result}
  <div class="panel" role="region" aria-label="Design scan results">
    <div class="title">Design Scan ({scan.result.stats.elementsScanned} elements)</div>
    {#if scan.result.findings.length === 0}
      <div class="message">No design issues found.</div>
    {:else}
      {#each scan.result.findings as f, i (i)}
        <div class="finding">
          <div class="rule {f.severity}">{f.rule}</div>
          <div class="message">{f.message}</div>
        </div>
      {/each}
    {/if}
    <div class="stats">
      {headingSummary()} | Fonts: {topFonts()} | Centered: {scan.result.stats.centeredElements}
    </div>
    <button class="ghost" onclick={() => scan.close()}>Close</button>
  </div>
{/if}

<style>
  .panel {
    position: fixed;
    right: 16px;
    bottom: 72px;
    z-index: var(--k-z);
    width: 360px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    background: var(--k-bg);
    color: var(--k-fg);
    border: 1px solid var(--k-border);
    border-radius: 12px;
    padding: 12px;
    font-size: 13px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }
  .title {
    margin: 0 0 8px 0;
    font-size: 11px;
    color: var(--k-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .finding {
    padding: 8px 0;
    border-top: 1px solid var(--k-border-soft);
  }
  .finding:first-of-type { border-top: none; }
  .rule {
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .rule.error { color: var(--k-err); }
  .rule.warning { color: var(--k-warn); }
  .rule.info { color: #60a5fa; }
  .message { color: #ccc; font-size: 12px; margin-top: 2px; }
  .stats {
    color: #6b7280;
    font-size: 11px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--k-border-soft);
  }
  .ghost {
    background: transparent;
    color: #aaa;
    border: 1px solid #333;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    margin-top: 8px;
  }
</style>
```

- [ ] **Step 12.2: Commit**

```bash
git add packages/client/src/ui/ScanResults.svelte
git commit -m "client/ui: add ScanResults component"
```

---

## Task 13: ExtractForm component

**Files:**
- Create: `packages/client/src/ui/ExtractForm.svelte`

- [ ] **Step 13.1: Implement**

Create `packages/client/src/ui/ExtractForm.svelte`:

```svelte
<script lang="ts">
  import type { ElementSelection } from "@konstner/core";
  import { useAppContext } from "../stores/context.js";

  interface Props {
    selection: ElementSelection;
  }
  let { selection }: Props = $props();

  const { history, panel } = useAppContext();

  function defaultName(tag: string): string {
    const base = tag.replace(/[^a-z0-9]+/gi, "") || "Block";
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  let name = $state(defaultName(selection.tagName));
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    input?.focus();
    input?.select();
  });

  function submit() {
    const finalName = name.trim() || defaultName(selection.tagName);
    history.extract({ selection, name: finalName });
    panel.closeExtract();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") panel.closeExtract();
  }
</script>

<div class="form section">
  <h3>Extract to component</h3>
  <div class="prop-row">
    <label for="k-extract-name">name</label>
    <input
      id="k-extract-name"
      type="text"
      bind:this={input}
      bind:value={name}
      placeholder="ComponentName"
      onkeydown={onKey}
    />
  </div>
  <div class="actions">
    <button class="primary" onclick={submit}>Extract</button>
    <button class="ghost" onclick={() => panel.closeExtract()}>Cancel</button>
  </div>
</div>

<style>
  .section {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--k-border-soft);
  }
  h3 {
    margin: 0 0 8px 0;
    font-size: 11px;
    color: var(--k-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .prop-row {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }
  label { font-size: 11px; color: var(--k-muted); }
  input {
    background: var(--k-surface);
    color: var(--k-fg);
    border: 1px solid #333;
    border-radius: 4px;
    padding: 4px 6px;
    font-family: var(--k-mono);
    font-size: 12px;
    width: 100%;
  }
  .actions { display: flex; gap: 8px; margin-top: 8px; }
  .primary {
    background: var(--k-accent);
    color: var(--k-accent-fg);
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  }
  .ghost {
    background: transparent;
    color: #aaa;
    border: 1px solid #333;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
  }
</style>
```

- [ ] **Step 13.2: Commit**

```bash
git add packages/client/src/ui/ExtractForm.svelte
git commit -m "client/ui: add ExtractForm component"
```

---

## Task 14: ContinueForm component

**Files:**
- Create: `packages/client/src/ui/ContinueForm.svelte`

- [ ] **Step 14.1: Implement**

Create `packages/client/src/ui/ContinueForm.svelte`:

```svelte
<script lang="ts">
  import { useAppContext } from "../stores/context.js";

  interface Props {
    parentId: string;
    threadId: string;
  }
  let { parentId, threadId }: Props = $props();

  const { history } = useAppContext();

  let value = $state("");
  let ta: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    ta?.focus();
  });

  function submit() {
    const v = value.trim();
    if (!v) return;
    history.continueThread(parentId, v);
    value = "";
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
    if (e.key === "Escape") history.closeContinue(threadId);
  }
</script>

<div class="form">
  <textarea
    bind:this={ta}
    bind:value
    onkeydown={onKey}
    placeholder="Refine or follow up... (⌘↵ to send)"
  ></textarea>
  <button class="confirm" onclick={submit}>Send follow-up</button>
</div>

<style>
  .form {
    margin-top: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  textarea {
    min-height: 48px;
    font-size: 12px;
    padding: 6px;
    background: var(--k-surface);
    color: var(--k-fg);
    border: 1px solid #333;
    border-radius: 6px;
    font-family: inherit;
    resize: vertical;
  }
  .confirm {
    background: transparent;
    color: #fca5a5;
    border: 1px solid #7f1d1d;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
  }
</style>
```

- [ ] **Step 14.2: Commit**

```bash
git add packages/client/src/ui/ContinueForm.svelte
git commit -m "client/ui: add ContinueForm component"
```

---

## Task 15: Thread component

**Files:**
- Create: `packages/client/src/ui/Thread.svelte`

- [ ] **Step 15.1: Implement**

Create `packages/client/src/ui/Thread.svelte`:

```svelte
<script lang="ts">
  import type { ThreadView } from "../stores/history.svelte.js";
  import { useAppContext } from "../stores/context.js";
  import ContinueForm from "./ContinueForm.svelte";

  interface Props {
    thread: ThreadView;
  }
  let { thread }: Props = $props();

  const { history } = useAppContext();

  const rowStatus = $derived(
    thread.reverted ? "reverted" : thread.busy ? "loading" : "done",
  );
  const latest = $derived(thread.turns[thread.turns.length - 1]);

  function toggleContinue() {
    if (thread.continueOpen) history.closeContinue(thread.root.threadId);
    else history.openContinue(thread.root.threadId);
  }

  function onRevertClick() {
    if (thread.confirming) history.requestRevert(thread.root.threadId);
    else history.confirmRevert(thread.root.threadId);
  }
</script>

<div class="row {rowStatus}">
  <div class="dot"></div>
  <div class="body">
    <div class="target">{thread.root.target}</div>
    <div class="turns">
      {#each thread.turns as turn, idx (turn.id)}
        <div
          class="turn"
          class:follow={idx > 0}
          class:loading={turn.status === "loading"}
        >
          {#if idx > 0}
            <div class="turn-label">Follow-up {idx}</div>
          {/if}
          <div class="prompt">{turn.prompt}</div>
          {#if turn.summary}
            <div class="summary">{turn.summary}</div>
          {/if}
        </div>
      {/each}
    </div>

    {#if !thread.reverted}
      <div class="actions">
        <button onclick={toggleContinue} disabled={thread.busy}>
          {thread.continueOpen ? "Cancel" : "Continue"}
        </button>
        <button
          class:confirm={thread.confirming}
          onclick={onRevertClick}
          disabled={thread.busy || thread.reverting}
        >
          {thread.reverting
            ? "Reverting…"
            : thread.confirming
              ? "Confirm revert?"
              : "Revert"}
        </button>
      </div>

      {#if thread.continueOpen}
        <ContinueForm parentId={latest.id} threadId={thread.root.threadId} />
      {/if}
    {/if}
  </div>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: 10px 1fr;
    gap: 8px;
    padding: 8px 0;
    border-top: 1px solid var(--k-border-soft);
  }
  .row:first-of-type { border-top: none; }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 5px;
    background: #4b5563;
  }
  .row.loading .dot {
    background: var(--k-warn);
    animation: k-pulse 1s ease-in-out infinite;
  }
  .row.done .dot { background: var(--k-success); }
  .row.reverted .dot { background: #6b7280; }
  .target {
    color: var(--k-blue-text);
    font-family: var(--k-mono);
    font-size: 11px;
    word-break: break-all;
  }
  .turns {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
  }
  .turn {
    position: relative;
    padding-left: 12px;
    border-left: 2px solid var(--k-hist-border);
  }
  .turn.follow { border-left-color: var(--k-accent); }
  .turn.loading { border-left-color: var(--k-warn); }
  .turn-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #6b7280;
    margin-bottom: 2px;
  }
  .turn.follow .turn-label { color: #60a5fa; }
  .prompt { color: var(--k-fg); margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
  .summary {
    color: var(--k-muted);
    margin-top: 4px;
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .actions { display: flex; gap: 6px; margin-top: 6px; }
  .actions button {
    background: transparent;
    color: #aaa;
    border: 1px solid #2a2a36;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-family: inherit;
  }
  .actions button:hover:not(:disabled) {
    color: var(--k-fg);
    border-color: #3a3a46;
  }
  .actions button:disabled { opacity: 0.35; cursor: not-allowed; }
  .actions button.confirm {
    color: #fca5a5;
    border-color: #7f1d1d;
  }
</style>
```

- [ ] **Step 15.2: Commit**

```bash
git add packages/client/src/ui/Thread.svelte
git commit -m "client/ui: add Thread component"
```

---

## Task 16: History component

**Files:**
- Create: `packages/client/src/ui/History.svelte`

- [ ] **Step 16.1: Implement**

Create `packages/client/src/ui/History.svelte`:

```svelte
<script lang="ts">
  import { useAppContext } from "../stores/context.js";
  import Thread from "./Thread.svelte";

  const { history } = useAppContext();
  const visibleThreads = $derived(history.threads.slice(0, 20));
</script>

{#if visibleThreads.length > 0}
  <div class="panel" role="region" aria-label="Request history">
    <div class="title">Requests</div>
    {#each visibleThreads as thread (thread.root.threadId)}
      <Thread {thread} />
    {/each}
  </div>
{/if}

<style>
  .panel {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: var(--k-z);
    width: 340px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    background: var(--k-bg);
    color: var(--k-fg);
    border: 1px solid var(--k-border);
    border-radius: 12px;
    padding: 10px;
    font-size: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }
  .title {
    margin: 0 0 8px 0;
    font-size: 11px;
    color: var(--k-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
</style>
```

- [ ] **Step 16.2: Commit**

```bash
git add packages/client/src/ui/History.svelte
git commit -m "client/ui: add History component"
```

---

## Task 17: Panel component

**Files:**
- Create: `packages/client/src/ui/Panel.svelte`

- [ ] **Step 17.1: Implement**

Create `packages/client/src/ui/Panel.svelte`:

```svelte
<script lang="ts">
  import { describe } from "../picker.js";
  import { useAppContext } from "../stores/context.js";
  import { findNextAnnotatedAncestor } from "../stores/selection.svelte.js";
  import ExtractForm from "./ExtractForm.svelte";

  const { panel, picker, selection, history, scan } = useAppContext();

  let textarea: HTMLTextAreaElement | undefined = $state();
  let prompt = $state("");

  const sel = $derived(selection.current);
  const picking = $derived(picker.isActive());
  const locLine = $derived.by(() => {
    if (!sel) {
      return picking
        ? "Click an element on the page, or describe a page-level change below."
        : "No element selected — requests will target this page.";
    }
    return sel.loc
      ? `${sel.loc.file}:${sel.loc.line}:${sel.loc.col}`
      : "(no source location — did the plugin transform this file?)";
  });

  const hasAnnotatedAncestor = $derived(
    findNextAnnotatedAncestor(selection.element) !== null,
  );

  $effect(() => {
    if (panel.open) queueMicrotask(() => textarea?.focus());
  });

  function togglePicker() {
    if (picker.isActive()) picker.stop();
    else picker.start();
  }

  function stepUp() {
    const next = findNextAnnotatedAncestor(selection.element);
    if (!next) return;
    const newSel = describe(next);
    selection.setFromPicker(newSel);
  }

  function clear() {
    selection.clear();
  }

  function submit() {
    if (!prompt.trim()) return;
    history.submit({
      prompt,
      selection: sel,
      path: location.pathname,
    });
    prompt = "";
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
  }

  // Arrow-up on non-input to step up to annotated ancestor.
  $effect(() => {
    if (!panel.open) return;
    function onGlobalKey(e: KeyboardEvent) {
      if (!selection.current) return;
      if (e.key !== "ArrowUp" || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      e.preventDefault();
      stepUp();
    }
    window.addEventListener("keydown", onGlobalKey, true);
    return () => window.removeEventListener("keydown", onGlobalKey, true);
  });

</script>

{#if panel.open}
  <div class="panel" role="dialog" aria-label="Konstner panel">
    <h3>{sel ? "Selected" : "Page"}</h3>

    <div class="row">
      {#if sel}
        <span class="badge">&lt;{sel.tagName}&gt;</span>
        <button
          class="ghost step-up"
          title="Select parent (↑)"
          disabled={!hasAnnotatedAncestor}
          onclick={stepUp}
        >↑</button>
      {:else}
        <span class="badge">{location.pathname}</span>
      {/if}
      <button class="ghost" onclick={togglePicker}>
        {picking ? "Cancel" : sel ? "Pick another" : "Pick element"}
      </button>
      {#if sel}
        <button
          class="ghost"
          title="Clear selection (send a page-level request)"
          onclick={clear}
        >Clear</button>
      {/if}
    </div>

    <div class="loc">{locLine}</div>

    <textarea
      bind:this={textarea}
      bind:value={prompt}
      onkeydown={onKey}
      placeholder={sel
        ? "Describe the change... (⌘↵ to send)"
        : "Describe a change to this page... (⌘↵ to send)"}
    ></textarea>

    <div class="actions">
      <button class="primary" onclick={submit}>Send</button>
      {#if sel}
        <button
          class="ghost"
          title="Extract this subtree into a new Svelte component"
          onclick={() => (panel.extractOpen ? panel.closeExtract() : panel.openExtract())}
        >Extract…</button>
      {/if}
      <button class="ghost scan-btn" title="Scan page for design issues" onclick={() => scan.run()}>
        Scan
      </button>
    </div>

    {#if sel && panel.extractOpen}
      <ExtractForm selection={sel} />
    {/if}
  </div>
{/if}

<style>
  .panel {
    position: fixed;
    right: 16px;
    bottom: 72px;
    z-index: var(--k-z);
    width: 360px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    background: var(--k-bg);
    color: var(--k-fg);
    border: 1px solid var(--k-border);
    border-radius: 12px;
    padding: 12px;
    font-size: 13px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }
  h3 {
    margin: 0 0 8px 0;
    font-size: 12px;
    color: var(--k-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
  .badge {
    background: var(--k-hist-border);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--k-mono);
    font-size: 11px;
  }
  .loc {
    color: var(--k-blue-text);
    font-family: var(--k-mono);
    font-size: 11px;
    word-break: break-all;
  }
  textarea {
    width: 100%;
    min-height: 72px;
    background: var(--k-surface);
    color: var(--k-fg);
    border: 1px solid #333;
    border-radius: 6px;
    padding: 8px;
    font-family: inherit;
    font-size: 13px;
    resize: vertical;
  }
  .actions { display: flex; gap: 8px; margin-top: 8px; }
  .primary {
    background: var(--k-accent);
    color: var(--k-accent-fg);
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  }
  .ghost {
    background: transparent;
    color: #aaa;
    border: 1px solid #333;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
  }
  .step-up { padding: 2px 8px; font-size: 12px; line-height: 1; }
  .step-up:disabled { opacity: 0.35; cursor: not-allowed; }
  .scan-btn {
    color: var(--k-muted);
    padding: 4px 8px;
    font-size: 11px;
  }
  .scan-btn:hover { color: var(--k-fg); border-color: #555; }
</style>
```

- [ ] **Step 17.2: Commit**

```bash
git add packages/client/src/ui/Panel.svelte
git commit -m "client/ui: add Panel component"
```

---

## Task 18: App component (root)

Installs the AppContext and renders all children.

**Files:**
- Create: `packages/client/src/ui/App.svelte`

- [ ] **Step 18.1: Implement**

Create `packages/client/src/ui/App.svelte`:

```svelte
<script lang="ts">
  import type { AppContext } from "../stores/context.js";
  import { provideAppContext } from "../stores/context.js";
  import Fab from "./Fab.svelte";
  import Panel from "./Panel.svelte";
  import History from "./History.svelte";
  import ScanResults from "./ScanResults.svelte";
  import Outlines from "./Outlines.svelte";
  import Toasts from "./Toasts.svelte";

  interface Props {
    ctx: AppContext;
  }
  let { ctx }: Props = $props();

  provideAppContext(ctx);
</script>

<Fab />
<Panel />
<History />
<ScanResults />
<Outlines />
<Toasts />
```

- [ ] **Step 18.2: Commit**

```bash
git add packages/client/src/ui/App.svelte
git commit -m "client/ui: add App root with context provision"
```

---

## Task 19: Component smoke test

One integration test to confirm the pipeline works.

**Files:**
- Create: `packages/client/src/ui/App.test.ts`

- [ ] **Step 19.1: Write test**

Create `packages/client/src/ui/App.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import { afterEach } from "vitest";
import App from "./App.svelte";
import { createToastsStore } from "../stores/toasts.svelte.js";
import { createSelectionStore } from "../stores/selection.svelte.js";
import { createHoverStore } from "../stores/hover.svelte.js";
import { createHistoryStore } from "../stores/history.svelte.js";
import { createPanelStore } from "../stores/panel.svelte.js";
import { createScanStore } from "../stores/scan.svelte.js";

afterEach(() => cleanup());

function makeCtx() {
  const send = vi.fn();
  const ws = { send, onMessage: () => () => {}, close: () => {} };
  const picker = {
    start: vi.fn(),
    stop: vi.fn(),
    isActive: vi.fn(() => false),
  } as unknown as import("../picker.js").Picker;
  const toasts = createToastsStore();
  const selection = createSelectionStore({ send });
  const hover = createHoverStore();
  const history = createHistoryStore({ send });
  const panel = createPanelStore();
  const scan = createScanStore({
    send,
    scanner: () => ({
      findings: [],
      stats: {
        elementsScanned: 0,
        headings: [],
        fontFamilies: new Map(),
        centeredElements: 0,
      },
    }),
  });
  return { ws, picker, toasts, selection, hover, history, panel, scan };
}

describe("App smoke", () => {
  it("renders the fab", () => {
    const { getByLabelText } = render(App, { props: { ctx: makeCtx() } });
    expect(getByLabelText("Toggle Konstner")).toBeInTheDocument();
  });

  it("panel is hidden by default and opens on fab click", async () => {
    const ctx = makeCtx();
    const { getByLabelText, queryByRole } = render(App, { props: { ctx } });
    expect(queryByRole("dialog", { name: "Konstner panel" })).toBeNull();
    (getByLabelText("Toggle Konstner") as HTMLButtonElement).click();
    // Svelte flushes synchronously for $state mutations in v5
    expect(ctx.panel.open).toBe(true);
  });
});
```

- [ ] **Step 19.2: Run it**

Run: `pnpm vitest run packages/client/src/ui/App.test.ts`
Expected: PASS (2 tests). If Svelte's `mount()` complains about styles in happy-dom, add `compilerOptions: { css: "injected" }` to the Svelte plugin config in `vitest.config.ts`.

- [ ] **Step 19.3: Commit**

```bash
git add packages/client/src/ui/App.test.ts
git commit -m "client/ui: add App smoke test"
```

---

## Task 20: Rewrite `overlay.ts` to mount the Svelte app

The keystone commit. Replace imperative implementation with Svelte `mount()`.

**Files:**
- Modify: `packages/client/src/overlay.ts` (complete rewrite)

- [ ] **Step 20.1: Replace `overlay.ts`**

Replace the entire contents of `packages/client/src/overlay.ts` with:

```ts
import { mount, unmount } from "svelte";
import type { ServerToClient } from "@konstner/core";
import App from "./ui/App.svelte";
import { Picker } from "./picker.js";
import { ROOT_CSS } from "./ui/tokens.css.js";
import { connectWs } from "./ws.js";
import { createHistoryStore } from "./stores/history.svelte.js";
import { createHoverStore } from "./stores/hover.svelte.js";
import { createPanelStore } from "./stores/panel.svelte.js";
import { createScanStore } from "./stores/scan.svelte.js";
import { createSelectionStore } from "./stores/selection.svelte.js";
import { createToastsStore } from "./stores/toasts.svelte.js";
import type { AppContext } from "./stores/context.js";

export interface OverlayHandle {
  destroy(): void;
}

export function mountOverlay(opts: { port: number }): OverlayHandle {
  const host = document.createElement("div");
  host.id = "konstner-overlay-host";
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "open" });

  const rootStyle = document.createElement("style");
  rootStyle.textContent = ROOT_CSS;
  shadow.appendChild(rootStyle);

  const ws = connectWs(opts.port);

  const toasts = createToastsStore();
  const selection = createSelectionStore({ send: ws.send });
  const hover = createHoverStore();
  const history = createHistoryStore({ send: ws.send });
  const panel = createPanelStore();
  const scan = createScanStore({ send: ws.send });

  const picker = new Picker(host, {
    onHover(el) {
      hover.set(el);
    },
    onSelect(sel) {
      selection.setFromPicker(sel);
    },
  });

  const offMessage = ws.onMessage((msg: ServerToClient) => {
    if (msg.type === "toast") {
      toasts.push(msg.level, msg.message);
    } else if (msg.type === "request_resolved") {
      history.handleResolved({ id: msg.id, summary: msg.summary });
    } else if (msg.type === "edit_applied") {
      toasts.push("success", `Applied ${msg.edits.length} edit(s).`);
    } else if (msg.type === "request_reverted") {
      history.handleReverted({ threadId: msg.threadId, files: msg.files });
      toasts.push("success", `Reverted ${msg.files.length} file(s).`);
    }
  });

  const ctx: AppContext = {
    ws,
    picker,
    selection,
    hover,
    history,
    panel,
    scan,
    toasts,
  };

  const appInstance = mount(App, { target: shadow, props: { ctx } });

  document.body.appendChild(host);

  return {
    destroy() {
      offMessage();
      unmount(appInstance);
      ws.close();
      picker.stop();
      host.remove();
    },
  };
}
```

- [ ] **Step 20.2: Typecheck**

Run: `pnpm --filter @konstner/client typecheck`
Expected: success. If errors reference old removed symbols, confirm they came from outside `overlay.ts` (none should).

- [ ] **Step 20.3: Run all client tests**

Run: `pnpm vitest run packages/client`
Expected: all tests PASS.

- [ ] **Step 20.4: Build**

Run: `pnpm --filter @konstner/client build`
Expected: TypeScript build succeeds; `dist/overlay.js`, `dist/ui/App.svelte.js` etc. produced.

- [ ] **Step 20.5: Commit**

```bash
git add packages/client/src/overlay.ts
git commit -m "client: rewrite mountOverlay on top of Svelte 5 app"
```

---

## Task 21: Manual smoke in SvelteKit demo

Verifies the mounted UI actually works in a real host app.

**Files:**
- None (verification only; fix-forward if broken).

- [ ] **Step 21.1: Start demo**

Run: `pnpm dev:demo` (in a separate terminal; leave running).
Expected: SvelteKit dev server starts, usually at `http://localhost:5173`.

- [ ] **Step 21.2: Verify in browser**

Open the URL. Verify in order:

1. "K" fab appears bottom-right.
2. Click fab → panel opens bottom-right; "Pick element" button visible.
3. Hover over a demo component → blue outline follows cursor.
4. Click a demo component → green outline on that element, panel shows `<tag>` badge and source location.
5. Type into the textarea; ⌘↵ sends (the request appears in the left-hand Requests panel as a loading row). Let it resolve; dot turns green.
6. Click "Continue" → textarea appears; send a follow-up. Status reflects.
7. Click "Revert" twice → confirm → request goes; on `request_reverted`, row greys.
8. Click "Scan" → scan results panel appears bottom-right, fab unchanged.
9. Click "Extract…" → form appears inside panel; enter a name; Extract sends.

If any step fails, fix the offending component/store and return to 21.1.

- [ ] **Step 21.3: Commit any fixes found**

Commit message: `client: fix <specific issue> found during demo smoke`.

---

## Task 22: Final cleanup and doc

**Files:**
- Modify: (maybe) `packages/client/src/KonstnerShell.svelte` — only if behavior diverged
- Modify: `README.md` if it documents the overlay internals

- [ ] **Step 22.1: Verify `KonstnerShell.svelte` unchanged behavior**

Run: `cat packages/client/src/KonstnerShell.svelte`
Confirm the file still calls `mountOverlay({ port })` in `onMount` and `handle?.destroy()` in `onDestroy`. No changes needed.

- [ ] **Step 22.2: Check README for stale internals references**

Run: `grep -n "renderPanel\|renderHistory\|STYLES" README.md || echo "clean"`
If not "clean", update prose references. Otherwise skip.

- [ ] **Step 22.3: Verify final line counts**

Run: `wc -l packages/client/src/overlay.ts packages/client/src/ui/*.svelte packages/client/src/stores/*.ts`
Expected: `overlay.ts` ≈ 80–100 lines; each component 30–160 lines.

- [ ] **Step 22.4: Final pnpm test + typecheck**

Run:
```bash
pnpm typecheck
pnpm test
pnpm --filter @konstner/client build
```
Expected: all pass.

- [ ] **Step 22.5: Commit (if there were any fixes in 22.1/22.2)**

```bash
git add -A
git commit -m "client: final cleanup after overlay Svelte rewrite"
```

If nothing changed, skip the commit.

---

## Post-plan verification checklist

- [ ] `packages/client/src/overlay.ts` no longer contains `STYLES`, `renderHistory`, `renderPanel`, `openExtractForm`, `runPageScan`, `renderScanResults`, `drawSelectedBox`, `sendContinue`, `sendExtract`, `submit`, `toast`, `findByLoc`, `findNextAnnotatedAncestor`, `defaultComponentName`, `targetLabel`, `groupThreads`.
- [ ] `packages/client/src/ui/` contains the 10 `.svelte` components listed in the File layout.
- [ ] `packages/client/src/stores/` contains 7 modules (toasts, selection, history, panel, scan, hover, context) + their tests.
- [ ] `svelte` is a `dependencies` entry in `packages/client/package.json`, not `peerDependencies`.
- [ ] `pnpm test` green.
- [ ] `pnpm --filter @konstner/client build` green.
- [ ] Manual smoke in sveltekit-demo passed all 9 interactions in Task 21.2.
