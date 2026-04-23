import { describe, it, expect } from "vitest";
import { createPanelStore } from "./panel.svelte.js";

describe("panel store", () => {
  it("toggle flips open", () => {
    const s = createPanelStore();
    expect(s.open).toBe(false);
    s.toggle();
    expect(s.open).toBe(true);
    s.toggle();
    expect(s.open).toBe(false);
  });

  it("openExtract / closeExtract flag", () => {
    const s = createPanelStore();
    s.openExtract();
    expect(s.extractOpen).toBe(true);
    s.closeExtract();
    expect(s.extractOpen).toBe(false);
  });
});
