import type { ElementSelection, SourceLoc } from "@konstner/core";

export interface PickerCallbacks {
  onHover(el: HTMLElement | null): void;
  onSelect(sel: ElementSelection): void;
}

const RELEVANT_STYLES = [
  "display",
  "color",
  "background-color",
  "font-size",
  "font-family",
  "font-weight",
  "line-height",
  "padding",
  "margin",
  "border-radius",
  "border",
  "width",
  "height",
  "flex",
  "gap",
];

export class Picker {
  private active = false;
  private lastHover: HTMLElement | null = null;
  private hostRoot: Node;

  constructor(
    hostRoot: Node,
    private readonly cb: PickerCallbacks,
  ) {
    this.hostRoot = hostRoot;
  }

  start() {
    if (this.active) return;
    this.active = true;
    document.addEventListener("mousemove", this.onMove, true);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("keydown", this.onKey, true);
  }

  stop() {
    this.active = false;
    document.removeEventListener("mousemove", this.onMove, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKey, true);
    this.cb.onHover(null);
  }

  isActive() {
    return this.active;
  }

  private onMove = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || this.isOwnUi(target)) {
      this.cb.onHover(null);
      return;
    }
    if (target === this.lastHover) return;
    this.lastHover = target;
    this.cb.onHover(target);
  };

  private onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target || this.isOwnUi(target)) return;
    e.preventDefault();
    e.stopPropagation();
    const selection = describe(target);
    this.cb.onSelect(selection);
    this.stop();
  };

  private onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this.stop();
  };

  private isOwnUi(el: HTMLElement): boolean {
    let node: Node | null = el;
    while (node) {
      if (node === this.hostRoot) return true;
      node = (node as any).parentNode ?? (node as any).host ?? null;
    }
    return false;
  }
}

export function describe(el: HTMLElement): ElementSelection {
  const kLocId = el.getAttribute("data-k-loc") ?? "";
  return {
    kLocId,
    loc: parseLoc(kLocId),
    tagName: el.tagName.toLowerCase(),
    outerHTML: el.outerHTML.slice(0, 4000),
    computedStyles: pickStyles(el),
    ancestors: ancestors(el),
  };
}

function parseLoc(raw: string): SourceLoc | null {
  if (!raw) return null;
  const last = raw.lastIndexOf(":");
  if (last < 0) return null;
  const midCut = raw.lastIndexOf(":", last - 1);
  if (midCut < 0) return null;
  const file = raw.slice(0, midCut);
  const line = Number(raw.slice(midCut + 1, last));
  const col = Number(raw.slice(last + 1));
  if (!Number.isFinite(line) || !Number.isFinite(col)) return null;
  return { file, line, col };
}

function pickStyles(el: HTMLElement): Record<string, string> {
  const cs = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const prop of RELEVANT_STYLES) out[prop] = cs.getPropertyValue(prop).trim();
  return out;
}

function ancestors(el: HTMLElement) {
  const out: ElementSelection["ancestors"] = [];
  let node: HTMLElement | null = el.parentElement;
  let depth = 0;
  while (node && depth < 8) {
    out.push({
      tagName: node.tagName.toLowerCase(),
      loc: parseLoc(node.getAttribute("data-k-loc") ?? ""),
    });
    node = node.parentElement;
    depth++;
  }
  return out;
}
