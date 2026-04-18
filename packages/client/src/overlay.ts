import type { ElementSelection, ServerToClient } from "@konstner/core";
import { Picker, describe } from "./picker.js";
import { connectWs } from "./ws.js";

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
.prop-row { display: grid; grid-template-columns: 80px 1fr; gap: 8px; align-items: center; margin-bottom: 6px; }
.prop-row label { font-size: 11px; color: #9aa; }
.prop-row input[type="text"], .prop-row input[type="number"], .prop-row select {
  background: #111; color: #eee; border: 1px solid #333; border-radius: 4px;
  padding: 4px 6px; font-family: ui-monospace, monospace; font-size: 12px;
  width: 100%;
}
.prop-row input[type="color"] {
  width: 28px; height: 22px; border: 1px solid #333; border-radius: 4px; padding: 0; background: transparent; cursor: pointer;
}
.color-group { display: flex; gap: 6px; align-items: center; }
.color-group input[type="text"] { flex: 1; }
.panel h3 { margin: 0 0 8px 0; font-size: 12px; color: #9aa; letter-spacing: 0.1em; text-transform: uppercase; }
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

  const ws = connectWs(opts.port);
  let currentSelection: ElementSelection | null = null;
  let selectedEl: HTMLElement | null = null;

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
      fab.classList.remove("active");
      renderPanel();
    },
  });

  fab.addEventListener("click", () => {
    if (picker.isActive()) {
      picker.stop();
      fab.classList.remove("active");
    } else {
      picker.start();
      fab.classList.add("active");
      panel.style.display = "none";
    }
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
    if (!currentSelection) {
      panel.style.display = "none";
      return;
    }
    const sel = currentSelection;
    panel.style.display = "block";
    panel.innerHTML = "";

    const header = document.createElement("h3");
    header.textContent = "Selected";
    panel.appendChild(header);

    const row = document.createElement("div");
    row.className = "row";
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
    panel.appendChild(row);

    const locEl = document.createElement("div");
    locEl.className = "loc";
    locEl.textContent = sel.loc
      ? `${sel.loc.file}:${sel.loc.line}:${sel.loc.col}`
      : "(no source location — did the plugin transform this file?)";
    panel.appendChild(locEl);

    const ta = document.createElement("textarea");
    ta.placeholder = "Describe the change... (⌘↵ to send)";
    panel.appendChild(ta);

    const actions = document.createElement("div");
    actions.className = "actions";
    const send = document.createElement("button");
    send.className = "primary";
    send.textContent = "Send to Claude";
    send.addEventListener("click", () => submit(ta.value));
    ta.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(ta.value);
    });
    const extract = document.createElement("button");
    extract.className = "ghost";
    extract.textContent = "Extract…";
    extract.title = "Extract this subtree into a new Svelte component";
    extract.addEventListener("click", () => openExtractForm(sel, panel));
    const close = document.createElement("button");
    close.className = "ghost";
    close.textContent = "Close";
    close.addEventListener("click", () => {
      currentSelection = null;
      selectedEl = null;
      selectedBox.style.display = "none";
      panel.style.display = "none";
    });
    actions.appendChild(send);
    actions.appendChild(extract);
    actions.appendChild(close);
    panel.appendChild(actions);

    if (sel.loc) {
      panel.appendChild(buildPropertySection(sel, sendPropertyEdit));
    }
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
    toast("info", `Extracting ${name}… Claude is working.`);
  }

  function sendPropertyEdit(property: string, value: string) {
    if (!currentSelection) return;
    ws.send({
      type: "apply_property_edit",
      selection: currentSelection,
      property,
      value,
    });
  }

  function submit(prompt: string) {
    if (!currentSelection || !prompt.trim()) return;
    const id = `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    ws.send({
      type: "request_change",
      id,
      selection: currentSelection,
      prompt: prompt.trim(),
    });
    toast("info", "Queued for Claude — run a session to process it.");
  }

  ws.onMessage((msg: ServerToClient) => {
    if (msg.type === "toast") toast(msg.level, msg.message);
    else if (msg.type === "request_resolved")
      toast("success", msg.summary || "Done.");
    else if (msg.type === "edit_applied")
      toast("success", `Applied ${msg.edits.length} edit(s).`);
  });

  function toast(level: "info" | "success" | "error", message: string) {
    const el = document.createElement("div");
    el.className = `toast ${level}`;
    el.textContent = message;
    shadow.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  document.body.appendChild(host);
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

interface PropertyDef {
  label: string;
  property: string;
  kind: "text" | "color" | "select";
  options?: string[];
  placeholder?: string;
}

const SECTIONS: Array<{ title: string; props: PropertyDef[] }> = [
  {
    title: "Layout",
    props: [
      {
        label: "display",
        property: "display",
        kind: "select",
        options: ["", "block", "inline", "inline-block", "flex", "grid", "none"],
      },
      { label: "width", property: "width", kind: "text", placeholder: "auto" },
      { label: "height", property: "height", kind: "text", placeholder: "auto" },
      { label: "gap", property: "gap", kind: "text", placeholder: "0" },
    ],
  },
  {
    title: "Spacing",
    props: [
      { label: "padding", property: "padding", kind: "text", placeholder: "0" },
      { label: "margin", property: "margin", kind: "text", placeholder: "0" },
      {
        label: "radius",
        property: "border-radius",
        kind: "text",
        placeholder: "0",
      },
    ],
  },
  {
    title: "Typography",
    props: [
      {
        label: "font-size",
        property: "font-size",
        kind: "text",
        placeholder: "14px",
      },
      {
        label: "weight",
        property: "font-weight",
        kind: "select",
        options: ["", "400", "500", "600", "700", "800"],
      },
      { label: "color", property: "color", kind: "color" },
    ],
  },
  {
    title: "Background",
    props: [
      { label: "background", property: "background-color", kind: "color" },
      { label: "border", property: "border", kind: "text", placeholder: "none" },
    ],
  },
];

function buildPropertySection(
  sel: {
    computedStyles: Record<string, string>;
  },
  onChange: (property: string, value: string) => void,
): HTMLElement {
  const root = document.createElement("div");
  for (const section of SECTIONS) {
    const wrap = document.createElement("div");
    wrap.className = "section";
    const h = document.createElement("h3");
    h.textContent = section.title;
    wrap.appendChild(h);
    for (const def of section.props) {
      wrap.appendChild(buildPropRow(def, sel.computedStyles, onChange));
    }
    root.appendChild(wrap);
  }
  return root;
}

function buildPropRow(
  def: PropertyDef,
  styles: Record<string, string>,
  onChange: (property: string, value: string) => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "prop-row";
  const lab = document.createElement("label");
  lab.textContent = def.label;
  row.appendChild(lab);

  const current = styles[def.property] ?? "";
  const debouncedChange = debounce(onChange, 300);

  if (def.kind === "select") {
    const sel = document.createElement("select");
    for (const opt of def.options ?? []) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt || "(unset)";
      if (opt === current) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", () => onChange(def.property, sel.value));
    row.appendChild(sel);
    return row;
  }

  if (def.kind === "color") {
    const group = document.createElement("div");
    group.className = "color-group";
    const hex = rgbToHex(current);
    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = hex || "#000000";
    const text = document.createElement("input");
    text.type = "text";
    text.value = current;
    text.placeholder = "#000 or rgb(...)";
    picker.addEventListener("input", () => {
      text.value = picker.value;
      debouncedChange(def.property, picker.value);
    });
    text.addEventListener("input", () => {
      debouncedChange(def.property, text.value);
    });
    group.appendChild(picker);
    group.appendChild(text);
    row.appendChild(group);
    return row;
  }

  const input = document.createElement("input");
  input.type = "text";
  input.value = current;
  if (def.placeholder) input.placeholder = def.placeholder;
  input.addEventListener("input", () => {
    debouncedChange(def.property, input.value);
  });
  row.appendChild(input);
  return row;
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...(args as Parameters<T>)), ms);
  }) as T;
}

function rgbToHex(raw: string): string {
  if (!raw) return "";
  if (raw.startsWith("#")) return raw.length === 7 ? raw : "";
  const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(raw);
  if (!m) return "";
  const [r, g, b] = [m[1], m[2], m[3]].map((n) =>
    Number(n).toString(16).padStart(2, "0"),
  );
  return `#${r}${g}${b}`;
}
