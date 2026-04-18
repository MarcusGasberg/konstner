import { describe, it, expect } from "vitest";
import { createPlainHtmlAdapter } from "./plain-html.js";

describe("plain-html adapter", () => {
  const adapter = createPlainHtmlAdapter();

  it("has the correct id", () => {
    expect(adapter.id).toBe("plain-html");
  });

  it("matches .html only", () => {
    expect(adapter.matches("index.html")).toBe(true);
    expect(adapter.matches("foo.svelte")).toBe(false);
  });

  it("annotates body elements; skips html/head/body/title/meta/link/base/script/style", () => {
    const src = `<!doctype html><html><head><title>x</title></head><body><main><p>hi</p></main></body></html>`;
    const out = adapter.annotate(src, { filename: "index.html" });
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`<main data-k-loc=`);
    expect(out!.code).toContain(`<p data-k-loc=`);
    expect(out!.code).not.toContain(`<title data-k-loc=`);
    expect(out!.code).not.toContain(`<html data-k-loc=`);
    expect(out!.code).not.toContain(`<body data-k-loc=`);
    expect(out!.code).not.toContain(`<head data-k-loc=`);
  });

  it("applyPropertyEdit returns null (prompt-dispatch only)", () => {
    expect(
      adapter.applyPropertyEdit({
        file: "x.html", line: 0, col: 0, property: "color", value: "red", source: "<p></p>",
      }),
    ).toBeNull();
  });

  it("has plain-html extension and prompts", () => {
    expect(adapter.componentExtension).toBe(".html");
    expect(adapter.prompts.change).toBeTruthy();
    expect(adapter.prompts.extract).toBeTruthy();
  });
});
