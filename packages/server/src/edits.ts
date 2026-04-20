import { readFile, writeFile } from "node:fs/promises";
import MagicString from "magic-string";
import type { FrameworkAdapter, TextEdit } from "@konstner/core";
import { touchesExportedSurface, verifyFileSyntax, type VerifyFailure } from "./verify.js";

export interface ApplyEditsSuccess {
  ok: true;
  edits: TextEdit[];
  touchedFiles: string[];
  exportedSurfaceChanged: boolean;
}
export interface ApplyEditsFailure {
  ok: false;
  errors: VerifyFailure[];
}
export type ApplyEditsResult = ApplyEditsSuccess | ApplyEditsFailure;

export async function applyTextEdits(
  edits: TextEdit[],
  adapters: FrameworkAdapter[] = [],
): Promise<ApplyEditsResult> {
  const byFile = new Map<string, TextEdit[]>();
  for (const e of edits) {
    const arr = byFile.get(e.file) ?? [];
    arr.push(e);
    byFile.set(e.file, arr);
  }

  const staged: Array<{ file: string; content: string; fileEdits: TextEdit[] }> = [];
  const errors: VerifyFailure[] = [];

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
    const content = ms.toString();
    const verdict = await verifyFileSyntax(file, content, adapters);
    if (!verdict.ok) {
      errors.push(verdict.error);
    } else {
      staged.push({ file, content, fileEdits });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  for (const s of staged) {
    await writeFile(s.file, s.content, "utf8");
  }

  let exportedSurfaceChanged = false;
  for (const s of staged) {
    if (touchesExportedSurface(s.file, s.fileEdits, s.content)) {
      exportedSurfaceChanged = true;
      break;
    }
  }

  return {
    ok: true,
    edits,
    touchedFiles: staged.map((s) => s.file),
    exportedSurfaceChanged,
  };
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
