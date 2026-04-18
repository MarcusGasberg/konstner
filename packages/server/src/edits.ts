import { readFile, writeFile } from "node:fs/promises";
import MagicString from "magic-string";
import type { TextEdit } from "@konstner/core";

export async function applyTextEdits(edits: TextEdit[]): Promise<void> {
  const byFile = new Map<string, TextEdit[]>();
  for (const e of edits) {
    const arr = byFile.get(e.file) ?? [];
    arr.push(e);
    byFile.set(e.file, arr);
  }
  for (const [file, fileEdits] of byFile) {
    const source = await readFile(file, "utf8");
    const ms = new MagicString(source);
    const offsets = buildLineOffsets(source);
    const sorted = [...fileEdits].sort(
      (a, b) =>
        toOffset(offsets, b.startLine, b.startCol) -
        toOffset(offsets, a.startLine, a.startCol),
    );
    for (const edit of sorted) {
      const start = toOffset(offsets, edit.startLine, edit.startCol);
      const end = toOffset(offsets, edit.endLine, edit.endCol);
      ms.overwrite(start, end, edit.newText);
    }
    await writeFile(file, ms.toString(), "utf8");
  }
}

function buildLineOffsets(src: string): number[] {
  const offsets = [0];
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10) offsets.push(i + 1);
  }
  return offsets;
}

function toOffset(offsets: number[], line: number, col: number): number {
  const base = offsets[line - 1] ?? 0;
  return base + col;
}
