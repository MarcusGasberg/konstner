import { describe, it, expect } from "vitest";
import { applySveltePropertyEdit } from "./svelte-rewrite.js";

describe("applySveltePropertyEdit", () => {
  it("injects a new style attribute when none exists", () => {
    const src = `<div data-k-loc="App.svelte:1:0">hi</div>\n`;
    const out = applySveltePropertyEdit({
      file: "/abs/App.svelte",
      line: 1,
      col: 0,
      property: "color",
      value: "red",
      source: src,
    });
    expect(out).not.toBeNull();
    expect(out!.newSource).toContain(`style="color: red;"`);
    expect(out!.edits).toHaveLength(1);
    expect(out!.edits[0].file).toBe("/abs/App.svelte");
  });

  it("updates an existing style declaration in place", () => {
    const src = `<div data-k-loc="App.svelte:1:0" style="color: blue;">hi</div>`;
    const out = applySveltePropertyEdit({
      file: "/abs/App.svelte",
      line: 1,
      col: 0,
      property: "color",
      value: "red",
      source: src,
    });
    expect(out!.newSource).toContain("color: red");
    expect(out!.newSource).not.toContain("color: blue");
  });

  it("returns null when the opening tag is not at the given position", () => {
    const src = `  <div>x</div>`;
    const out = applySveltePropertyEdit({
      file: "/abs/x.svelte",
      line: 1,
      col: 0, // pointing at a space, not `<`
      property: "color",
      value: "red",
      source: src,
    });
    expect(out).toBeNull();
  });
});
