export const TAG_RE = /<([a-z][a-z0-9-]*)(?=[\s/>])([^>]*?)(\/?)>/g;
export const BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function findBlockedRanges(src: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const m of src.matchAll(BLOCK_RE)) {
    const s = m.index ?? 0;
    ranges.push([s, s + m[0].length]);
  }
  return ranges;
}

export function isInRanges(pos: number, ranges: Array<[number, number]>): boolean {
  for (const [s, e] of ranges) {
    if (pos >= s && pos < e) return true;
  }
  return false;
}

export function buildLineOffsets(src: string): number[] {
  const out = [0];
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10) out.push(i + 1);
  }
  return out;
}

export function toLineCol(
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
