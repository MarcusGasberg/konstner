import MagicString from "magic-string";
import type { AnnotateResult, AnnotateContext } from "@konstner/core";

const TAG_RE = /<([a-z][a-z0-9-]*)(?=[\s/>])([^>]*?)(\/?)>/g;
const BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * Build an `annotate` function that injects `data-k-loc` attributes into
 * elements matching the shared HTML-like tag regex. The adapter provides
 * `skipTag` to decide which tag names to leave untouched (e.g. Svelte's
 * uppercase components, or plain-HTML's document-chrome tags).
 *
 * Content inside `<script>`/`<style>` blocks is always skipped.
 */
export function createHtmlLikeAnnotator(opts: {
  skipTag: (tagName: string) => boolean;
}): (code: string, ctx: AnnotateContext) => AnnotateResult | null {
  return (code, ctx) => {
    const ms = new MagicString(code);
    let touched = false;
    const offsets = buildLineOffsets(code);
    const blocked = findBlockedRanges(code);
    for (const match of code.matchAll(TAG_RE)) {
      const start = match.index ?? 0;
      if (isInRanges(start, blocked)) continue;
      const tagName = match[1];
      if (opts.skipTag(tagName)) continue;
      const attrs = match[2] ?? "";
      if (attrs.includes("data-k-loc=")) continue;
      const { line, col } = toLineCol(offsets, start);
      ms.appendLeft(
        start + 1 + tagName.length,
        ` data-k-loc="${ctx.filename}:${line}:${col}"`,
      );
      touched = true;
    }
    if (!touched) return null;
    return {
      code: ms.toString(),
      map: ms.generateMap({ hires: true, source: ctx.filename }),
    };
  };
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

function toLineCol(
  offsets: number[],
  pos: number,
): { line: number; col: number } {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: pos - offsets[lo] };
}
