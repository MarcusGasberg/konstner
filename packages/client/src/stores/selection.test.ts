import { describe, it, expect, vi } from "vitest";
import type { ElementSelection } from "@konstner/core";
import { createSelectionStore } from "./selection.svelte.js";

function makeSel(kLocId: string, tag = "div"): ElementSelection {
  return {
    kLocId,
    loc: { file: "App.svelte", line: 1, col: 0 },
    tagName: tag,
    outerHTML: `<${tag}></${tag}>`,
    computedStyles: {},
    ancestors: [],
  };
}

describe("selection store", () => {
  it("setFromPicker stores the selection and publishes to ws", () => {
    const send = vi.fn();
    const s = createSelectionStore({ send });
    const sel = makeSel("k1");
    s.setFromPicker(sel);
    expect(s.current).toEqual(sel);
    expect(send).toHaveBeenCalledWith({ type: "selection_changed", selection: sel });
  });

  it("clear nulls the selection and publishes null", () => {
    const send = vi.fn();
    const s = createSelectionStore({ send });
    s.setFromPicker(makeSel("k1"));
    s.clear();
    expect(s.current).toBeNull();
    expect(send).toHaveBeenLastCalledWith({ type: "selection_changed", selection: null });
  });

  it("resolveElement uses document.querySelector by data-k-loc", () => {
    document.body.innerHTML = `<div data-k-loc="xyz">x</div>`;
    const s = createSelectionStore({ send: vi.fn() });
    s.setFromPicker(makeSel("xyz"));
    expect(s.element?.getAttribute("data-k-loc")).toBe("xyz");
  });

  it("element is null when kLocId is empty", () => {
    const s = createSelectionStore({ send: vi.fn() });
    s.setFromPicker(makeSel(""));
    expect(s.element).toBeNull();
  });
});
