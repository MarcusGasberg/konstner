import MagicString from "magic-string";

const TAG_RE = /<([a-z][a-z0-9-]*)(?=[\s/>])([^>]*?)(\/?)>/g;
const BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function annotateSvelteSource(
  code: string,
  filename: string,
): { code: string; map: ReturnType<MagicString["generateMap"]> } | null {
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
    // skip Svelte special tags (start with uppercase or `svelte:`)
    if (/^[A-Z]/.test(tagName) || tagName.includes(":")) continue;

    const { line, col } = toLineCol(offsets, start);
    const insertAt = start + 1 + tagName.length;
    const selfClose = match[3] === "/";
    const injected = ` data-k-loc="${filename}:${line}:${col}"`;
    ms.appendLeft(insertAt, injected);
    touched = true;
    void selfClose;
  }

  if (!touched) return null;
  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true, source: filename }),
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
