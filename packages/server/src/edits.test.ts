import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyTextEdits } from "./edits.js";
import type { FrameworkAdapter, TextEdit } from "@konstner/core";

const noAdapters: FrameworkAdapter[] = [];

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "konstner-edits-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("applyTextEdits", () => {
  it("writes a valid edit and reports touched files", async () => {
    const file = join(dir, "a.ts");
    await writeFile(file, "export const x = 1;\n", "utf8");
    const edit: TextEdit = {
      file,
      startLine: 1,
      startCol: 17,
      endLine: 1,
      endCol: 18,
      newText: "42",
    };
    const r = await applyTextEdits([edit], noAdapters);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.touchedFiles).toEqual([file]);
      expect(r.exportedSurfaceChanged).toBe(true);
    }
    expect(await readFile(file, "utf8")).toBe("export const x = 42;\n");
  });

  it("rejects edits that break syntax and leaves the file untouched", async () => {
    const file = join(dir, "a.ts");
    const original = "export const x = 1;\n";
    await writeFile(file, original, "utf8");
    const edit: TextEdit = {
      file,
      startLine: 1,
      startCol: 17,
      endLine: 1,
      endCol: 19,
      newText: "(((",
    };
    const r = await applyTextEdits([edit], noAdapters);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThan(0);
      expect(r.errors[0].file).toBe(file);
    }
    expect(await readFile(file, "utf8")).toBe(original);
  });

  it("is all-or-nothing across multiple files", async () => {
    const good = join(dir, "good.ts");
    const bad = join(dir, "bad.ts");
    await writeFile(good, "export const g = 1;\n", "utf8");
    await writeFile(bad, "export const b = 2;\n", "utf8");
    const edits: TextEdit[] = [
      { file: good, startLine: 1, startCol: 17, endLine: 1, endCol: 18, newText: "99" },
      { file: bad, startLine: 1, startCol: 17, endLine: 1, endCol: 19, newText: "(((" },
    ];
    const r = await applyTextEdits(edits, noAdapters);
    expect(r.ok).toBe(false);
    expect(await readFile(good, "utf8")).toBe("export const g = 1;\n");
    expect(await readFile(bad, "utf8")).toBe("export const b = 2;\n");
  });

  it("reports exportedSurfaceChanged=false when only internals are edited", async () => {
    const file = join(dir, "a.ts");
    await writeFile(file, "const internal = 1;\nexport const api = internal;\n", "utf8");
    const edit: TextEdit = {
      file,
      startLine: 1,
      startCol: 17,
      endLine: 1,
      endCol: 18,
      newText: "42",
    };
    const r = await applyTextEdits([edit], noAdapters);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.exportedSurfaceChanged).toBe(false);
  });
});
