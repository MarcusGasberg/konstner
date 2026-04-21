import { describe, it, expect } from "vitest";
import { checkDesign } from "./rules.js";
import { parseColor, contrastRatio } from "./color.js";

describe("design-check color parser", () => {
  it("parses hex colors", () => {
    expect(parseColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses rgb colors", () => {
    expect(parseColor("rgb(255, 128, 0)")).toEqual({ r: 255, g: 128, b: 0 });
    expect(parseColor("rgb(255 128 0)")).toEqual({ r: 255, g: 128, b: 0 });
  });

  it("calculates contrast", () => {
    const black = parseColor("#000000")!;
    const white = parseColor("#ffffff")!;
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0);
  });
});

describe("design-check rules", () => {
  it("detects AI gradient palette in CSS", () => {
    const css = `.card { background: linear-gradient(135deg, purple, cyan); }`;
    const findings = checkDesign("test.css", css);
    expect(findings.some((f) => f.rule === "ai-gradient-palette")).toBe(true);
  });

  it("detects gradient text", () => {
    const css = `.hero { -webkit-background-clip: text; }`;
    const findings = checkDesign("test.css", css);
    expect(findings.some((f) => f.rule === "gradient-text")).toBe(true);
  });

  it("detects low contrast", () => {
    const css = `.text { color: #9ca3af; background-color: #ffffff; }`;
    const findings = checkDesign("test.css", css);
    expect(findings.some((f) => f.rule === "low-contrast")).toBe(true);
  });

  it("detects overused font", () => {
    const css = `body { font-family: Inter, sans-serif; }`;
    const findings = checkDesign("test.css", css);
    expect(findings.some((f) => f.rule === "overused-font")).toBe(true);
  });

  it("detects Tailwind AI gradient", () => {
    const html = `<div class="bg-gradient-to-r from-purple-500 to-cyan-500">Hello</div>`;
    const findings = checkDesign("test.svelte", html);
    expect(findings.some((f) => f.rule === "ai-gradient-palette")).toBe(true);
  });

  it("detects Tailwind low contrast", () => {
    const html = `<div class="text-gray-400 bg-white">Hello</div>`;
    const findings = checkDesign("test.svelte", html);
    expect(findings.some((f) => f.rule === "low-contrast")).toBe(true);
  });

  it("detects Tailwind tiny text", () => {
    const html = `<p class="text-xs">Small</p>`;
    const findings = checkDesign("test.svelte", html);
    expect(findings.some((f) => f.rule === "tiny-body-text")).toBe(true);
  });

  it("detects skipped headings", () => {
    const html = `<h1>Title</h1><h3>Subtitle</h3>`;
    const findings = checkDesign("test.html", html);
    expect(findings.some((f) => f.rule === "skipped-heading")).toBe(true);
  });

  it("detects pure black background", () => {
    const css = `body { background: #000000; }`;
    const findings = checkDesign("test.css", css);
    expect(findings.some((f) => f.rule === "pure-black-bg")).toBe(true);
  });

  it("detects nested cards", () => {
    const css = `.card { padding: 16px; } .card .card { margin: 8px; }`;
    const findings = checkDesign("test.css", css);
    expect(findings.some((f) => f.rule === "nested-cards")).toBe(true);
  });
});
