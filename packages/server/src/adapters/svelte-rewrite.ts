import MagicString from "magic-string";
import type { TextEdit, PropertyEditInput } from "@konstner/core";

export type ApplyResult = { newSource: string; edits: TextEdit[] };

export function applySveltePropertyEdit(
  params: PropertyEditInput,
): ApplyResult | null {
  const src = params.source;
  const offsets = buildLineOffsets(src);
  const base = offsets[params.line - 1] ?? 0;
  const tagStart = base + params.col;

  if (src[tagStart] !== "<") return null;

  const tagEnd = findOpeningTagEnd(src, tagStart);
  if (tagEnd === -1) return null;

  const ms = new MagicString(src);
  const style = findStyleAttr(src, tagStart, tagEnd);

  let editStart: number;
  let editEnd: number;
  let newText: string;

  if (style) {
    const existing = src.slice(style.valueStart, style.valueEnd);
    const next = patchStyleAttr(existing, params.property, params.value);
    ms.overwrite(style.valueStart, style.valueEnd, next);
    editStart = style.valueStart;
    editEnd = style.valueEnd;
    newText = next;
  } else {
    const insertAt = src[tagEnd - 1] === "/" ? tagEnd - 1 : tagEnd;
    const inserted = ` style="${params.property}: ${params.value};"`;
    ms.appendLeft(insertAt, inserted);
    editStart = insertAt;
    editEnd = insertAt;
    newText = inserted;
  }

  const startLC = toLineCol(offsets, editStart);
  const endLC = toLineCol(offsets, editEnd);

  return {
    newSource: ms.toString(),
    edits: [
      {
        file: params.file,
        startLine: startLC.line,
        startCol: startLC.col,
        endLine: endLC.line,
        endCol: endLC.col,
        newText,
      },
    ],
  };
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

function findOpeningTagEnd(src: string, startOffset: number): number {
  // Scan from after `<` to the matching `>` for the OPENING tag, respecting:
  //  - quoted attribute values (single or double)
  //  - Svelte/JSX-style `{ ... }` expressions (can contain `>` via `=>`, `>=` etc.)
  //  - balanced `{` / `}` within expressions
  let i = startOffset + 1;
  let quote: string | null = null;
  let braceDepth = 0;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (braceDepth > 0) {
      if (c === "{") braceDepth++;
      else if (c === "}") braceDepth--;
      else if (c === '"' || c === "'") {
        // skip string literals inside expressions
        const end = skipString(src, i, c);
        if (end === -1) return -1;
        i = end;
      }
    } else {
      if (c === '"' || c === "'") quote = c;
      else if (c === "{") braceDepth = 1;
      else if (c === ">") return i;
    }
    i++;
  }
  return -1;
}

function skipString(src: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") i += 2;
    else if (c === quote) return i;
    else i++;
  }
  return -1;
}

function findStyleAttr(
  src: string,
  start: number,
  end: number,
): { valueStart: number; valueEnd: number } | null {
  const region = src.slice(start, end);
  const re = /\bstyle\s*=\s*(["'])([^"']*)\1/;
  const m = re.exec(region);
  if (!m) return null;
  const attrOffset = m.index;
  const quoteOffset = attrOffset + m[0].indexOf(m[1]);
  const valueStart = start + quoteOffset + 1;
  const valueEnd = valueStart + m[2].length;
  return { valueStart, valueEnd };
}

export function patchStyleAttr(
  existing: string,
  prop: string,
  value: string,
): string {
  const decls = existing
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  let found = false;
  const target = prop.toLowerCase();
  for (const d of decls) {
    const colon = d.indexOf(":");
    if (colon < 0) {
      out.push(d);
      continue;
    }
    const p = d.slice(0, colon).trim();
    const v = d.slice(colon + 1).trim();
    if (p.toLowerCase() === target) {
      if (value) out.push(`${prop}: ${value}`);
      found = true;
    } else {
      out.push(`${p}: ${v}`);
    }
  }
  if (!found && value) out.push(`${prop}: ${value}`);
  return out.join("; ");
}
