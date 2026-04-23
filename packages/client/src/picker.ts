import type { ElementSelection, SourceLoc, DesignFlag } from "@konstner/core";

export interface PickerCallbacks {
  onHover(el: HTMLElement | null): void;
  onSelect(sel: ElementSelection): void;
  onActiveChange?(active: boolean): void;
}

const RELEVANT_STYLES = [
  "display",
  "color",
  "background-color",
  "background-image",
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
  "box-shadow",
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
    this.cb.onActiveChange?.(true);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    document.removeEventListener("mousemove", this.onMove, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKey, true);
    this.cb.onHover(null);
    this.cb.onActiveChange?.(false);
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

// ── Runtime Design Detection ─────────────────────────────────────────

function isCardLike(el: HTMLElement): boolean {
  const cs = getComputedStyle(el);
  const hasRadius = parseFloat(cs.borderRadius) > 0;
  const hasPadding = ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].some(
    (p) => parseFloat(cs[p as any]) >= 8,
  );
  const hasBorder = ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"].some(
    (b) => parseFloat(cs[b as any]) > 0,
  );
  const hasShadow = cs.boxShadow && cs.boxShadow !== "none";
  const hasBg =
    cs.backgroundColor &&
    cs.backgroundColor !== "rgba(0, 0, 0, 0)" &&
    cs.backgroundColor !== "transparent";

  let score = 0;
  if (hasRadius) score++;
  if (hasPadding) score++;
  if (hasBorder) score++;
  if (hasShadow) score++;
  if (hasBg) score++;

  return score >= 2;
}

function countNestedCards(el: HTMLElement): number {
  let count = 0;
  let node: HTMLElement | null = el.parentElement;
  while (node && count < 8) {
    if (isCardLike(node)) count++;
    node = node.parentElement;
  }
  return count;
}

function detectRuntimeFlags(el: HTMLElement): DesignFlag[] {
  const flags: DesignFlag[] = [];

  const nestedCardCount = countNestedCards(el);
  if (nestedCardCount >= 2) {
    flags.push({
      rule: "nested-cards",
      severity: "warning",
      message: `Detected ${nestedCardCount} card-like containers nested in ancestor chain. Flatten the hierarchy — use spacing, typography, and dividers instead.`,
    });
  }

  const cs = getComputedStyle(el);

  // Gradient text
  if (cs.backgroundClip === "text" || cs.webkitBackgroundClip === "text") {
    const bgImg = cs.backgroundImage;
    if (bgImg && bgImg.includes("gradient")) {
      flags.push({
        rule: "gradient-text",
        severity: "warning",
        message: "Gradient text kills scannability. Use solid colors for text.",
      });
    }
  }

  // AI gradient palette (purple/violet/cyan)
  const bgImg = cs.backgroundImage;
  if (bgImg && bgImg.includes("gradient")) {
    const lower = bgImg.toLowerCase();
    const hasPurple = /purple|violet|rgb\(138\s*,\s*43\s*,\s*226\)|#8b5cf6|#a855f7|#9333ea/.test(lower);
    const hasCyan = /cyan|teal|#06b6d4|#22d3ee|#0891b2/.test(lower);
    if (hasPurple || hasCyan) {
      flags.push({
        rule: "ai-gradient-palette",
        severity: "warning",
        message: "AI color palette detected: purple/violet/cyan gradient. Choose a distinctive, intentional palette.",
      });
    }
  }

  // Pure black background
  if (cs.backgroundColor === "rgb(0, 0, 0)" || cs.backgroundColor === "#000000") {
    flags.push({
      rule: "pure-black-bg",
      severity: "info",
      message: "Pure #000000 as a background looks harsh and unnatural. Tint it slightly toward your brand hue for a more refined feel.",
    });
  }

  // Tiny body text
  const fontSizePx = parseFloat(cs.fontSize);
  if (fontSizePx < 14 && fontSizePx > 0) {
    flags.push({
      rule: "tiny-body-text",
      severity: "warning",
      message: `Body text at ${Math.round(fontSizePx)}px is too small. Use at least 14px for body content, 16px is ideal.`,
    });
  }

  // Tight line-height
  const lineHeight = parseFloat(cs.lineHeight);
  const fontSize = parseFloat(cs.fontSize);
  if (fontSize > 0 && lineHeight > 0) {
    const ratio = lineHeight / fontSize;
    if (ratio < 1.3) {
      flags.push({
        rule: "tight-line-height",
        severity: "warning",
        message: `Line height of ${ratio.toFixed(2)} is too tight. Use 1.5 to 1.7 for body text so lines have room to breathe.`,
      });
    }
  }

  // Cramped padding
  const padTop = parseFloat(cs.paddingTop);
  const padRight = parseFloat(cs.paddingRight);
  const padBottom = parseFloat(cs.paddingBottom);
  const padLeft = parseFloat(cs.paddingLeft);
  if (padTop < 8 && padRight < 8 && padBottom < 8 && padLeft < 8) {
    // Only flag if element has border or background
    const hasBorder = ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"].some(
      (b) => parseFloat(cs[b as any]) > 0,
    );
    const hasBg =
      cs.backgroundColor &&
      cs.backgroundColor !== "rgba(0, 0, 0, 0)" &&
      cs.backgroundColor !== "transparent";
    if (hasBorder || hasBg) {
      flags.push({
        rule: "cramped-padding",
        severity: "info",
        message: "Padding is too cramped. Add at least 8px (ideally 12–16px) inside bordered or colored containers.",
      });
    }
  }

  return flags;
}

// ── Element Description ──────────────────────────────────────────────

export function describe(el: HTMLElement): ElementSelection {
  const kLocId = el.getAttribute("data-k-loc") ?? "";
  return {
    kLocId,
    loc: parseLoc(kLocId),
    tagName: el.tagName.toLowerCase(),
    outerHTML: el.outerHTML.slice(0, 4000),
    computedStyles: pickStyles(el),
    ancestors: ancestors(el),
    designFlags: detectRuntimeFlags(el),
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
