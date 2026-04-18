import MagicString from "magic-string";
import type { FrameworkAdapter, AnnotateResult, AnnotateContext } from "@konstner/core";

const TAG_RE = /<([a-z][a-z0-9-]*)(?=[\s/>])([^>]*?)(\/?)>/g;
const BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

const CHANGE_PROMPT = `You are editing a Svelte 5 component. Preserve <script>/<style> blocks; modify only the requested element's attributes, classes, or children. Use runes when adding state.`;
const EXTRACT_PROMPT = `Extract the given subtree into a new Svelte 5 component under src/lib/components/. Use <script lang="ts"> with $props(). Replace the original subtree with an import + usage.`;

export function createSvelteAdapter(): FrameworkAdapter {
  return {
    id: "svelte",
    matches: (id) => id.endsWith(".svelte"),
    annotate,
    applyPropertyEdit: () => null, // wired in Task 5
    prompts: { change: CHANGE_PROMPT, extract: EXTRACT_PROMPT },
    componentExtension: ".svelte",
  };
}

function annotate(code: string, ctx: AnnotateContext): AnnotateResult | null {
  const ms = new MagicString(code);
  let touched = false;
  const offsets = buildLineOffsets(code);
  const blocked = findBlockedRanges(code);
  for (const match of code.matchAll(TAG_RE)) {
    const start = match.index ?? 0;
    if (isInRanges(start, blocked)) continue;
    const tagName = match[1];
    const attrs = match[2] ?? "";
    if (attrs.includes("data-k-loc=")) continue;
    if (/^[A-Z]/.test(tagName) || tagName.includes(":")) continue;
    const { line, col } = toLineCol(offsets, start);
    ms.appendLeft(start + 1 + tagName.length, ` data-k-loc="${ctx.filename}:${line}:${col}"`);
    touched = true;
  }
  if (!touched) return null;
  return { code: ms.toString(), map: ms.generateMap({ hires: true, source: ctx.filename }) };
}

function findBlockedRanges(src: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const m of src.matchAll(BLOCK_RE)) {
    const s = m.index ?? 0;
    ranges.push([s, s + m[0].length]);
  }
  return ranges;
}

function isInRanges(pos: number, ranges: Array<[number, number]>): boolean {
  for (const [s, e] of ranges) {
    if (pos >= s && pos < e) return true;
  }
  return false;
}

function buildLineOffsets(src: string): number[] {
  const out = [0];
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10) out.push(i + 1);
  }
  return out;
}

function toLineCol(offsets: number[], pos: number): { line: number; col: number } {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: pos - offsets[lo] };
}
