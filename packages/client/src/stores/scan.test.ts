import { describe, it, expect, vi } from "vitest";
import type { ScanResult } from "../scan.js";
import { createScanStore } from "./scan.svelte.js";

const EMPTY_RESULT: ScanResult = {
  findings: [],
  stats: {
    elementsScanned: 0,
    headings: [],
    fontFamilies: new Map(),
    centeredElements: 0,
  },
};

describe("scan store", () => {
  it("run uses injected scanner, stores result, sends scan_page, sets visible", () => {
    const send = vi.fn();
    const scanner = vi.fn(() => EMPTY_RESULT);
    const s = createScanStore({ send, scanner, idGen: () => "scan_1" });
    s.run();
    expect(scanner).toHaveBeenCalled();
    expect(s.result).toBe(EMPTY_RESULT);
    expect(s.visible).toBe(true);
    expect(send).toHaveBeenCalledWith({
      type: "scan_page",
      id: "scan_1",
      findings: [],
    });
  });

  it("close hides without clearing", () => {
    const send = vi.fn();
    const s = createScanStore({ send, scanner: () => EMPTY_RESULT });
    s.run();
    s.close();
    expect(s.visible).toBe(false);
    expect(s.result).toBe(EMPTY_RESULT);
  });
});
