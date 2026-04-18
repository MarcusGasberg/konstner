import { describe, it, expect } from "vitest";
import { createSvelteAdapter } from "./svelte.js";

describe("svelte adapter", () => {
  const adapter = createSvelteAdapter();

  it("has the correct id", () => {
    expect(adapter.id).toBe("svelte");
  });

  it("matches .svelte files only", () => {
    expect(adapter.matches("/abs/App.svelte")).toBe(true);
    expect(adapter.matches("/abs/App.tsx")).toBe(false);
    expect(adapter.matches("/abs/index.html")).toBe(false);
  });

  it("injects data-k-loc into plain elements", () => {
    const src = `<div>\n  <span>hi</span>\n</div>\n`;
    const out = adapter.annotate(src, { filename: "App.svelte" });
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`data-k-loc="App.svelte:1:0"`);
    expect(out!.code).toContain(`data-k-loc="App.svelte:2:2"`);
  });

  it("skips component tags and svelte: tags", () => {
    const src = `<Foo /><svelte:head></svelte:head>`;
    const out = adapter.annotate(src, { filename: "x.svelte" });
    expect(out).toBeNull();
  });

  it("skips tags inside <script> and <style>", () => {
    const src = `<script>const x = "<div>";</script><style>.a{color:red}</style><p>hi</p>`;
    const out = adapter.annotate(src, { filename: "x.svelte" });
    expect(out).not.toBeNull();
    expect(out!.code.match(/data-k-loc/g)!.length).toBe(1);
  });

  it("has svelte-flavored prompts and .svelte extension", () => {
    expect(adapter.componentExtension).toBe(".svelte");
    expect(adapter.prompts.extract.toLowerCase()).toContain("svelte");
    expect(adapter.prompts.change.toLowerCase()).toContain("svelte");
  });

  it("applyPropertyEdit returns null (wired in Task 5)", () => {
    expect(
      adapter.applyPropertyEdit({
        file: "x.svelte", line: 0, col: 0, property: "color", value: "red", source: "<div></div>",
      }),
    ).toBeNull();
  });
});
