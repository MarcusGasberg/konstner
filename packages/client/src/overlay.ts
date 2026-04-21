import type { ElementSelection, ServerToClient } from "@konstner/core";
import { Picker, describe } from "./picker.js";
import { connectWs } from "./ws.js";
import { scanPage } from "./scan.js";

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, sans-serif; }
.fab {
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
  width: 44px; height: 44px; border-radius: 50%; border: none;
  background: #111; color: #fff; cursor: pointer; font-weight: 600;
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}
.fab.active { background: #2563eb; }
.panel {
  position: fixed; right: 16px; bottom: 72px; z-index: 2147483647;
  width: 360px; max-height: calc(100vh - 120px); overflow-y: auto;
  background: #0b0b0f; color: #eee; border: 1px solid #222;
  border-radius: 12px; padding: 12px; font-size: 13px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
}
.section { margin-top: 12px; padding-top: 10px; border-top: 1px solid #1a1a22; }
.section h3 { margin: 0 0 8px 0; font-size: 11px; color: #9aa; letter-spacing: 0.1em; text-transform: uppercase; }
.extract-form label { font-size: 11px; color: #9aa; }
.extract-form input[type="text"] {
  background: #111; color: #eee; border: 1px solid #333; border-radius: 4px;
  padding: 4px 6px; font-family: ui-monospace, monospace; font-size: 12px;
  width: 100%;
}
.extract-form .prop-row { display: grid; grid-template-columns: 80px 1fr; gap: 8px; align-items: center; margin-bottom: 6px; }
.panel h3 { margin: 0 0 8px 0; font-size: 12px; color: #9aa; letter-spacing: 0.1em; text-transform: uppercase; }
.history {
  position: fixed; left: 16px; bottom: 16px; z-index: 2147483647;
  width: 340px; max-height: calc(100vh - 120px); overflow-y: auto;
  background: #0b0b0f; color: #eee; border: 1px solid #222;
  border-radius: 12px; padding: 10px; font-size: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
}
.history[hidden] { display: none; }
.history-title { margin: 0 0 8px 0; font-size: 11px; color: #9aa; letter-spacing: 0.1em; text-transform: uppercase; }
.hist-row { display: grid; grid-template-columns: 10px 1fr; gap: 8px; padding: 8px 0; border-top: 1px solid #1a1a22; }
.hist-row:first-of-type { border-top: none; }
.hist-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; background: #4b5563; }
.hist-row.loading .hist-dot { background: #f59e0b; animation: k-pulse 1s ease-in-out infinite; }
.hist-row.done .hist-dot { background: #22c55e; }
.hist-row.reverted .hist-dot { background: #6b7280; }
.hist-turns { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.hist-turn { position: relative; padding-left: 12px; border-left: 2px solid #1f2937; }
.hist-turn.turn-follow-up { border-left-color: #2563eb; }
.hist-turn.turn-loading { border-left-color: #f59e0b; }
.hist-turn-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #6b7280; margin-bottom: 2px; }
.hist-turn.turn-follow-up .hist-turn-label { color: #60a5fa; }
.hist-actions { display: flex; gap: 6px; margin-top: 6px; }
.hist-actions button { background: transparent; color: #aaa; border: 1px solid #2a2a36; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; font-family: inherit; }
.hist-actions button:hover:not(:disabled) { color: #eee; border-color: #3a3a46; }
.hist-actions button:disabled { opacity: 0.35; cursor: not-allowed; }
.hist-actions button.confirm { color: #fca5a5; border-color: #7f1d1d; }
.hist-continue { margin-top: 6px; display: flex; flex-direction: column; gap: 6px; }
.hist-continue textarea { min-height: 48px; font-size: 12px; padding: 6px; }
@keyframes k-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.hist-target { color: #93c5fd; font-family: ui-monospace, monospace; font-size: 11px; word-break: break-all; }
.hist-prompt { color: #eee; margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
.hist-summary { color: #9aa; margin-top: 4px; font-size: 11px; white-space: pre-wrap; word-break: break-word; }
.row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
.step-up { padding: 2px 8px; font-size: 12px; line-height: 1; }
.step-up:disabled { opacity: 0.35; cursor: not-allowed; }
.badge { background: #1f2937; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 11px; }
.loc { color: #93c5fd; font-family: ui-monospace, monospace; font-size: 11px; word-break: break-all; }
textarea { width: 100%; min-height: 72px; background: #111; color: #eee; border: 1px solid #333; border-radius: 6px; padding: 8px; font-family: inherit; font-size: 13px; resize: vertical; }
.actions { display: flex; gap: 8px; margin-top: 8px; }
button.primary { background: #2563eb; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 600; }
button.ghost { background: transparent; color: #aaa; border: 1px solid #333; padding: 6px 10px; border-radius: 6px; cursor: pointer; }
.toast {
  position: fixed; right: 16px; bottom: 130px; z-index: 2147483647;
  background: #111; color: #fff; padding: 8px 12px; border-radius: 6px;
  border: 1px solid #333; font-size: 12px; max-width: 360px;
}
.toast.success { border-color: #22c55e; }
.toast.error { border-color: #ef4444; }
.outline {
  position: fixed; pointer-events: none; z-index: 2147483646;
  border: 2px solid #2563eb; background: rgba(37, 99, 235, 0.08);
  transition: all 50ms linear;
}
.outline.selected { border-color: #22c55e; background: rgba(34, 197, 94, 0.08); }
.scan-btn { background: transparent; color: #9aa; border: 1px solid #333; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; }
.scan-btn:hover { color: #eee; border-color: #555; }
.scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.scan-results {
  position: fixed; right: 16px; bottom: 72px; z-index: 2147483647;
  width: 360px; max-height: calc(100vh - 120px); overflow-y: auto;
  background: #0b0b0f; color: #eee; border: 1px solid #222;
  border-radius: 12px; padding: 12px; font-size: 13px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
}
.scan-results[hidden] { display: none; }
.scan-title { margin: 0 0 8px 0; font-size: 11px; color: #9aa; letter-spacing: 0.1em; text-transform: uppercase; }
.scan-finding { padding: 8px 0; border-top: 1px solid #1a1a22; }
.scan-finding:first-of-type { border-top: none; }
.scan-rule { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
.scan-rule.error { color: #ef4444; }
.scan-rule.warning { color: #f59e0b; }
.scan-rule.info { color: #60a5fa; }
.scan-message { color: #ccc; font-size: 12px; margin-top: 2px; }
.scan-stats { color: #6b7280; font-size: 11px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #1a1a22; }
`;

export function mountOverlay(opts: { port: number }) {
  const host = document.createElement("div");
  host.id = "konstner-overlay-host";
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = STYLES;
  shadow.appendChild(style);

  const fab = document.createElement("button");
  fab.className = "fab";
  fab.textContent = "K";
  fab.title = "Konstner (pick element)";
  shadow.appendChild(fab);

  const hoverBox = document.createElement("div");
  hoverBox.className = "outline";
  hoverBox.style.display = "none";
  shadow.appendChild(hoverBox);

  const selectedBox = document.createElement("div");
  selectedBox.className = "outline selected";
  selectedBox.style.display = "none";
  shadow.appendChild(selectedBox);

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.style.display = "none";
  shadow.appendChild(panel);

  const historyEl = document.createElement("div");
  historyEl.className = "history";
  historyEl.hidden = true;
  shadow.appendChild(historyEl);

  const scanResultsEl = document.createElement("div");
  scanResultsEl.className = "scan-results";
  scanResultsEl.hidden = true;
  shadow.appendChild(scanResultsEl);

  const ws = connectWs(opts.port);
  let currentSelection: ElementSelection | null = null;
  let selectedEl: HTMLElement | null = null;

  interface HistoryEntry {
    id: string;
    threadId: string;
    parentId?: string;
    kind: "prompt" | "extract";
    prompt: string;
    target: string;
    status: "loading" | "done" | "reverted";
    summary?: string;
    selection: ElementSelection | null;
    path?: string;
  }
  const history: HistoryEntry[] = [];
  const openContinueIds = new Set<string>();
  const revertConfirmIds = new Set<string>();
  const revertingThreadIds = new Set<string>();

  function targetLabel(sel: ElementSelection): string {
    const tag = `<${sel.tagName}>`;
    return sel.loc ? `${tag} ${sel.loc.file}:${sel.loc.line}` : tag;
  }

  interface ThreadView {
    root: HistoryEntry;
    turns: HistoryEntry[]; // chronological: root first, continuations after
  }

  function groupThreads(): ThreadView[] {
    const byThread = new Map<string, ThreadView>();
    const order: string[] = [];
    // history is newest-first; iterate reversed so we see root first and build chronological turns.
    for (let i = history.length - 1; i >= 0; i--) {
      const e = history[i];
      let t = byThread.get(e.threadId);
      if (!t) {
        t = { root: e, turns: [] };
        byThread.set(e.threadId, t);
        order.push(e.threadId);
      }
      if (e.id === e.threadId) t.root = e;
      t.turns.push(e);
    }
    // Newest thread first (by most recent turn).
    return order
      .map((id) => byThread.get(id)!)
      .sort((a, b) => {
        const aLast = history.findIndex((h) => h.threadId === a.root.threadId);
        const bLast = history.findIndex((h) => h.threadId === b.root.threadId);
        return aLast - bLast;
      });
  }

  function renderHistory() {
    const threads = groupThreads();
    historyEl.hidden = threads.length === 0;
    historyEl.innerHTML = "";
    if (threads.length === 0) return;
    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = "Requests";
    historyEl.appendChild(title);

    for (const thread of threads.slice(0, 20)) {
      const root = thread.root;
      const latest = thread.turns[thread.turns.length - 1];
      const threadBusy = thread.turns.some((t) => t.status === "loading");
      const threadReverted = thread.turns.some((t) => t.status === "reverted");
      const rowStatus = threadReverted
        ? "reverted"
        : threadBusy
          ? "loading"
          : "done";

      const row = document.createElement("div");
      row.className = `hist-row ${rowStatus}`;
      const dot = document.createElement("div");
      dot.className = "hist-dot";
      row.appendChild(dot);

      const body = document.createElement("div");
      const target = document.createElement("div");
      target.className = "hist-target";
      target.textContent = root.target;
      body.appendChild(target);

      const turnsEl = document.createElement("div");
      turnsEl.className = "hist-turns";
      thread.turns.forEach((turn, idx) => {
        const turnEl = document.createElement("div");
        const follow = idx > 0;
        turnEl.className = `hist-turn${follow ? " turn-follow-up" : ""}${turn.status === "loading" ? " turn-loading" : ""}`;
        if (follow) {
          const lab = document.createElement("div");
          lab.className = "hist-turn-label";
          lab.textContent = `Follow-up ${idx}`;
          turnEl.appendChild(lab);
        }
        const prompt = document.createElement("div");
        prompt.className = "hist-prompt";
        prompt.textContent = turn.prompt;
        turnEl.appendChild(prompt);
        if (turn.summary) {
          const sum = document.createElement("div");
          sum.className = "hist-summary";
          sum.textContent = turn.summary;
          turnEl.appendChild(sum);
        }
        turnsEl.appendChild(turnEl);
      });
      body.appendChild(turnsEl);

      if (!threadReverted) {
        const actions = document.createElement("div");
        actions.className = "hist-actions";

        const contBtn = document.createElement("button");
        const contOpen = openContinueIds.has(root.threadId);
        contBtn.textContent = contOpen ? "Cancel" : "Continue";
        contBtn.disabled = threadBusy;
        contBtn.addEventListener("click", () => {
          if (contOpen) openContinueIds.delete(root.threadId);
          else openContinueIds.add(root.threadId);
          renderHistory();
        });
        actions.appendChild(contBtn);

        const revBtn = document.createElement("button");
        const confirming = revertConfirmIds.has(root.threadId);
        const reverting = revertingThreadIds.has(root.threadId);
        revBtn.textContent = reverting
          ? "Reverting…"
          : confirming
            ? "Confirm revert?"
            : "Revert";
        if (confirming) revBtn.classList.add("confirm");
        revBtn.disabled = threadBusy || reverting;
        revBtn.addEventListener("click", () => {
          if (revertConfirmIds.has(root.threadId)) {
            revertConfirmIds.delete(root.threadId);
            revertingThreadIds.add(root.threadId);
            ws.send({ type: "request_revert", threadId: root.threadId });
            renderHistory();
            // Safety: if the server never responds, clear the reverting flag.
            setTimeout(() => {
              if (revertingThreadIds.delete(root.threadId)) renderHistory();
            }, 10000);
          } else {
            revertConfirmIds.add(root.threadId);
            renderHistory();
            setTimeout(() => {
              if (revertConfirmIds.delete(root.threadId)) renderHistory();
            }, 3000);
          }
        });
        actions.appendChild(revBtn);
        body.appendChild(actions);

        if (contOpen) {
          const form = document.createElement("div");
          form.className = "hist-continue";
          const ta = document.createElement("textarea");
          ta.placeholder = "Refine or follow up... (⌘↵ to send)";
          form.appendChild(ta);
          const sendBtn = document.createElement("button");
          sendBtn.textContent = "Send follow-up";
          sendBtn.className = "confirm";
          const submitContinue = () => {
            const val = ta.value.trim();
            if (!val) return;
            sendContinue(latest, val);
            openContinueIds.delete(root.threadId);
          };
          sendBtn.addEventListener("click", submitContinue);
          ta.addEventListener("keydown", (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitContinue();
            if (e.key === "Escape") {
              openContinueIds.delete(root.threadId);
              renderHistory();
            }
          });
          form.appendChild(sendBtn);
          body.appendChild(form);
          queueMicrotask(() => ta.focus());
        }
      }

      row.appendChild(body);
      historyEl.appendChild(row);
    }
  }

  function sendContinue(parent: HistoryEntry, prompt: string) {
    const id = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    ws.send({ type: "request_continue", id, parentId: parent.id, prompt });
    history.unshift({
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
    renderHistory();
  }

  let panelOpen = false;

  const picker = new Picker(host, {
    onHover(el) {
      if (!el) {
        hoverBox.style.display = "none";
        return;
      }
      const r = el.getBoundingClientRect();
      hoverBox.style.display = "block";
      hoverBox.style.top = `${r.top}px`;
      hoverBox.style.left = `${r.left}px`;
      hoverBox.style.width = `${r.width}px`;
      hoverBox.style.height = `${r.height}px`;
    },
    onSelect(sel) {
      currentSelection = sel;
      selectedEl = findByLoc(sel.kLocId);
      hoverBox.style.display = "none";
      drawSelectedBox();
      ws.send({ type: "selection_changed", selection: sel });
      renderPanel();
    },
  });

  function togglePicker() {
    if (picker.isActive()) picker.stop();
    else picker.start();
    renderPanel();
  }

  fab.addEventListener("click", () => {
    panelOpen = !panelOpen;
    if (panelOpen) picker.start();
    else picker.stop();
    renderPanel();
  });

  function drawSelectedBox() {
    if (!selectedEl) {
      selectedBox.style.display = "none";
      return;
    }
    const r = selectedEl.getBoundingClientRect();
    selectedBox.style.display = "block";
    selectedBox.style.top = `${r.top}px`;
    selectedBox.style.left = `${r.left}px`;
    selectedBox.style.width = `${r.width}px`;
    selectedBox.style.height = `${r.height}px`;
  }

  window.addEventListener("scroll", drawSelectedBox, true);
  window.addEventListener("resize", drawSelectedBox);

  // Picker may self-stop on Escape; keep the panel UI in sync.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && panelOpen) queueMicrotask(renderPanel);
    },
    true,
  );

  // Arrow-up steps to annotated ancestor when the panel is open.
  window.addEventListener(
    "keydown",
    (e) => {
      if (!currentSelection) return;
      if (e.key !== "ArrowUp" || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      stepUp();
    },
    true,
  );

  function renderPanel() {
    fab.classList.toggle("active", panelOpen);
    if (!panelOpen) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "block";
    panel.innerHTML = "";

    const sel = currentSelection;
    const picking = picker.isActive();

    const header = document.createElement("h3");
    header.textContent = sel ? "Selected" : "Page";
    panel.appendChild(header);

    const row = document.createElement("div");
    row.className = "row";
    if (sel) {
      const tagBadge = document.createElement("span");
      tagBadge.className = "badge";
      tagBadge.textContent = `<${sel.tagName}>`;
      row.appendChild(tagBadge);
      const parentBtn = document.createElement("button");
      parentBtn.className = "ghost step-up";
      parentBtn.textContent = "↑";
      parentBtn.title = "Select parent (↑)";
      parentBtn.disabled = !findNextAnnotatedAncestor(selectedEl);
      parentBtn.addEventListener("click", stepUp);
      row.appendChild(parentBtn);
    } else {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = location.pathname;
      row.appendChild(badge);
    }
    const pickBtn = document.createElement("button");
    pickBtn.className = "ghost";
    pickBtn.textContent = picking
      ? "Cancel"
      : sel
        ? "Pick another"
        : "Pick element";
    pickBtn.addEventListener("click", togglePicker);
    row.appendChild(pickBtn);
    if (sel) {
      const clearBtn = document.createElement("button");
      clearBtn.className = "ghost";
      clearBtn.textContent = "Clear";
      clearBtn.title = "Clear selection (send a page-level request)";
      clearBtn.addEventListener("click", () => {
        currentSelection = null;
        selectedEl = null;
        selectedBox.style.display = "none";
        ws.send({ type: "selection_changed", selection: null });
        renderPanel();
      });
      row.appendChild(clearBtn);
    }
    panel.appendChild(row);

    const locEl = document.createElement("div");
    locEl.className = "loc";
    if (sel) {
      locEl.textContent = sel.loc
        ? `${sel.loc.file}:${sel.loc.line}:${sel.loc.col}`
        : "(no source location — did the plugin transform this file?)";
    } else {
      locEl.textContent = picking
        ? "Click an element on the page, or describe a page-level change below."
        : "No element selected — requests will target this page.";
    }
    panel.appendChild(locEl);

    const ta = document.createElement("textarea");
    ta.placeholder = sel
      ? "Describe the change... (⌘↵ to send)"
      : "Describe a change to this page... (⌘↵ to send)";
    panel.appendChild(ta);

    const actions = document.createElement("div");
    actions.className = "actions";
    const send = document.createElement("button");
    send.className = "primary";
    send.textContent = "Send";
    send.addEventListener("click", () => submit(ta.value));
    ta.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(ta.value);
    });
    actions.appendChild(send);
    if (sel) {
      const extract = document.createElement("button");
      extract.className = "ghost";
      extract.textContent = "Extract…";
      extract.title = "Extract this subtree into a new Svelte component";
      extract.addEventListener("click", () => openExtractForm(sel, panel));
      actions.appendChild(extract);
    }
    const scanBtn = document.createElement("button");
    scanBtn.className = "ghost scan-btn";
    scanBtn.textContent = "Scan";
    scanBtn.title = "Scan page for design issues";
    scanBtn.addEventListener("click", () => runPageScan(scanBtn));
    actions.appendChild(scanBtn);
    panel.appendChild(actions);

    queueMicrotask(() => ta.focus());
  }

  function openExtractForm(sel: ElementSelection, panelEl: HTMLElement) {
    const existing = panelEl.querySelector(".extract-form");
    if (existing) {
      existing.remove();
      return;
    }
    const form = document.createElement("div");
    form.className = "extract-form section";
    const h = document.createElement("h3");
    h.textContent = "Extract to component";
    form.appendChild(h);
    const row = document.createElement("div");
    row.className = "prop-row";
    const lab = document.createElement("label");
    lab.textContent = "name";
    row.appendChild(lab);
    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultComponentName(sel.tagName);
    input.placeholder = "ComponentName";
    row.appendChild(input);
    form.appendChild(row);

    const btns = document.createElement("div");
    btns.className = "actions";
    const confirm = document.createElement("button");
    confirm.className = "primary";
    confirm.textContent = "Extract";
    const cancel = document.createElement("button");
    cancel.className = "ghost";
    cancel.textContent = "Cancel";
    const submitExtract = () => {
      const name = input.value.trim() || defaultComponentName(sel.tagName);
      sendExtract(sel, name);
      form.remove();
    };
    confirm.addEventListener("click", submitExtract);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitExtract();
      if (e.key === "Escape") form.remove();
    });
    cancel.addEventListener("click", () => form.remove());
    btns.appendChild(confirm);
    btns.appendChild(cancel);
    form.appendChild(btns);

    panelEl.appendChild(form);
    input.focus();
    input.select();
  }

  function stepUp() {
    const next = findNextAnnotatedAncestor(selectedEl);
    if (!next) return;
    const newSel = describe(next);
    currentSelection = newSel;
    selectedEl = next;
    drawSelectedBox();
    ws.send({ type: "selection_changed", selection: newSel });
    renderPanel();
  }

  function sendExtract(sel: ElementSelection, name: string) {
    const id = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    ws.send({
      type: "request_extract",
      id,
      selection: [sel],
      suggestedName: name,
    });
    history.unshift({
      id,
      threadId: id,
      kind: "extract",
      prompt: `Extract → ${name}`,
      target: targetLabel(sel),
      status: "loading",
      selection: sel,
    });
    renderHistory();
  }

  function submit(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const id = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const sel = currentSelection;
    const path = location.pathname;
    ws.send({
      type: "request_change",
      id,
      selection: sel,
      prompt: trimmed,
      path,
    });
    history.unshift({
      id,
      threadId: id,
      kind: "prompt",
      prompt: trimmed,
      target: sel ? targetLabel(sel) : `page ${path}`,
      status: "loading",
      selection: sel,
      path,
    });
    renderHistory();
    const ta = panel.querySelector("textarea");
    if (ta instanceof HTMLTextAreaElement) ta.value = "";
  }

  function runPageScan(btn: HTMLButtonElement) {
    btn.disabled = true;
    btn.textContent = "Scanning…";

    // Use requestIdleCallback if available, otherwise setTimeout
    const schedule =
      typeof requestIdleCallback !== "undefined"
        ? requestIdleCallback
        : (cb: () => void) => setTimeout(cb, 50);

    schedule(() => {
      try {
        const result = scanPage();
        renderScanResults(result);
        ws.send({
          type: "scan_page",
          id: `scan_${Date.now().toString(36)}`,
          findings: result.findings,
        });
      } catch (err) {
        toast("error", `Scan failed: ${(err as Error).message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = "Scan";
      }
    });
  }

  function renderScanResults(result: import("./scan.js").ScanResult) {
    scanResultsEl.hidden = false;
    scanResultsEl.innerHTML = "";

    const title = document.createElement("div");
    title.className = "scan-title";
    title.textContent = `Design Scan (${result.stats.elementsScanned} elements)`;
    scanResultsEl.appendChild(title);

    if (result.findings.length === 0) {
      const empty = document.createElement("div");
      empty.className = "scan-message";
      empty.textContent = "No design issues found.";
      scanResultsEl.appendChild(empty);
    } else {
      for (const finding of result.findings) {
        const row = document.createElement("div");
        row.className = "scan-finding";
        const rule = document.createElement("div");
        rule.className = `scan-rule ${finding.severity}`;
        rule.textContent = finding.rule;
        row.appendChild(rule);
        const msg = document.createElement("div");
        msg.className = "scan-message";
        msg.textContent = finding.message;
        row.appendChild(msg);
        scanResultsEl.appendChild(row);
      }
    }

    const stats = document.createElement("div");
    stats.className = "scan-stats";
    const headingSummary =
      result.stats.headings.length > 0
        ? `Headings: ${result.stats.headings.map((h) => `h${h.level}`).join(", ")}`
        : "No headings found";
    const fontSummary = Array.from(result.stats.fontFamilies.entries())
      .slice(0, 3)
      .map(([f, c]) => `${f} (${c})`)
      .join(", ");
    stats.textContent = `${headingSummary} | Fonts: ${fontSummary || "none"} | Centered: ${result.stats.centeredElements}`;
    scanResultsEl.appendChild(stats);

    const closeBtn = document.createElement("button");
    closeBtn.className = "ghost";
    closeBtn.textContent = "Close";
    closeBtn.style.marginTop = "8px";
    closeBtn.addEventListener("click", () => {
      scanResultsEl.hidden = true;
    });
    scanResultsEl.appendChild(closeBtn);
  }

  ws.onMessage((msg: ServerToClient) => {
    if (msg.type === "toast") {
      toast(msg.level, msg.message);
      if (revertingThreadIds.size > 0) {
        revertingThreadIds.clear();
        renderHistory();
      }
    } else if (msg.type === "request_resolved") {
      const entry = history.find((h) => h.id === msg.id);
      if (entry) {
        entry.status = "done";
        entry.summary = msg.summary;
        renderHistory();
      } else {
        toast("success", msg.summary || "Done.");
      }
    } else if (msg.type === "edit_applied")
      toast("success", `Applied ${msg.edits.length} edit(s).`);
    else if (msg.type === "request_reverted") {
      for (const entry of history) {
        if (entry.threadId === msg.threadId) entry.status = "reverted";
      }
      revertingThreadIds.delete(msg.threadId);
      renderHistory();
      toast("success", `Reverted ${msg.files.length} file(s).`);
    }
  });

  function toast(level: "info" | "success" | "error", message: string) {
    const el = document.createElement("div");
    el.className = `toast ${level}`;
    el.textContent = message;
    shadow.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  document.body.appendChild(host);
  renderPanel();
  return {
    destroy() {
      ws.close();
      picker.stop();
      host.remove();
    },
  } satisfies OverlayHandle;
}

export interface OverlayHandle {
  destroy(): void;
}

function findNextAnnotatedAncestor(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    if (node.getAttribute("data-k-loc")) return node;
    node = node.parentElement;
  }
  return null;
}

function defaultComponentName(tag: string): string {
  const base = tag.replace(/[^a-z0-9]+/gi, "") || "Block";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function findByLoc(kLocId: string): HTMLElement | null {
  if (!kLocId) return null;
  return document.querySelector<HTMLElement>(
    `[data-k-loc="${CSS.escape(kLocId)}"]`,
  );
}
