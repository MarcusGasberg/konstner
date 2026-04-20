import { describe, it, expect } from "vitest";
import { touchesExportedSurface, verifyFileSyntax } from "./verify.js";
import type { FrameworkAdapter, TextEdit } from "@konstner/core";

const noAdapters: FrameworkAdapter[] = [];

describe("verifyFileSyntax (generic TS/JS fallback)", () => {
  it("accepts valid TypeScript", async () => {
    const r = await verifyFileSyntax("/x.ts", "export const n: number = 1;\n", noAdapters);
    expect(r.ok).toBe(true);
  });

  it("rejects malformed TypeScript with location info", async () => {
    const r = await verifyFileSyntax("/x.ts", "const n: number = ;", noAdapters);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toMatch(/expression|expected|unexpected/i);
      expect(r.error.file).toBe("/x.ts");
    }
  });

  it("passes through unknown extensions", async () => {
    const r = await verifyFileSyntax("/x.txt", "<<< not code >>>", noAdapters);
    expect(r.ok).toBe(true);
  });

  it("delegates to matching adapter when it provides verifySyntax", async () => {
    const adapter: FrameworkAdapter = {
      id: "fake",
      matches: (f) => f.endsWith(".fake"),
      annotate: () => null,
      applyPropertyEdit: () => null,
      prompts: { change: "", extract: "" },
      componentExtension: ".fake",
      verifySyntax: () => ({ message: "always fails", line: 3 }),
    };
    const r = await verifyFileSyntax("/a.fake", "anything", [adapter]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toBe("always fails");
      expect(r.error.line).toBe(3);
    }
  });

  it("falls back to generic check when no adapter matches", async () => {
    const adapter: FrameworkAdapter = {
      id: "other",
      matches: (f) => f.endsWith(".other"),
      annotate: () => null,
      applyPropertyEdit: () => null,
      prompts: { change: "", extract: "" },
      componentExtension: ".other",
      verifySyntax: () => ({ message: "never called" }),
    };
    const r = await verifyFileSyntax("/x.ts", "export const n = 1;", [adapter]);
    expect(r.ok).toBe(true);
  });
});

describe("touchesExportedSurface", () => {
  const mkEdit = (startLine: number, endLine: number): TextEdit => ({
    file: "/x",
    startLine,
    startCol: 0,
    endLine,
    endCol: 0,
    newText: "",
  });

  it("detects export keyword on a touched line", () => {
    const src = "const a = 1;\nexport const b = 2;\nconst c = 3;\n";
    expect(touchesExportedSurface("/x.ts", [mkEdit(2, 2)], src)).toBe(true);
  });

  it("returns false when touched lines have no export markers", () => {
    const src = "const a = 1;\nexport const b = 2;\nconst c = 3;\n";
    expect(touchesExportedSurface("/x.ts", [mkEdit(1, 1)], src)).toBe(false);
  });

  it("detects Svelte $props()", () => {
    const src = "<script>\nlet { x } = $props();\n</script>\n<div>{x}</div>\n";
    expect(touchesExportedSurface("/x.svelte", [mkEdit(2, 2)], src)).toBe(true);
  });

  it("detects Vue defineProps()", () => {
    const src = "<script setup>\nconst p = defineProps<{x:number}>();\n</script>\n";
    expect(touchesExportedSurface("/x.vue", [mkEdit(2, 2)], src)).toBe(true);
  });

  it("detects <slot>", () => {
    const src = "<div>\n  <slot />\n</div>\n";
    expect(touchesExportedSurface("/x.svelte", [mkEdit(2, 2)], src)).toBe(true);
  });
});
