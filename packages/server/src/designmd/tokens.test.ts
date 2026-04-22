import { describe, expect, it } from "vitest";
import { toCssVars, findClosestColorToken, tokenColorValues } from "./tokens.js";
import type { DesignSystem } from "./index.js";

const ds: DesignSystem = {
  name: "t",
  colors: { primary: "#7aa2f7", background: "#0e1013", accent: "#e0af68" },
  typography: { body: { fontFamily: "IBM Plex Sans", fontSize: "16px" } },
  rounded: { md: "8px" },
  spacing: { md: "16px" },
  components: {},
  findings: [],
  raw: "",
  sourcePath: "/tmp/DESIGN.md",
};

describe("toCssVars", () => {
  it("produces :root block with color/typography/spacing/rounded vars", () => {
    const css = toCssVars(ds);
    expect(css).toContain(":root {");
    expect(css).toContain("--color-primary: #7aa2f7;");
    expect(css).toContain("--rounded-md: 8px;");
    expect(css).toContain("--spacing-md: 16px;");
    expect(css).toContain("--font-body-family: IBM Plex Sans;");
    expect(css).toContain("--font-body-size: 16px;");
  });
});

describe("findClosestColorToken", () => {
  it("returns the exact match token when hex matches", () => {
    expect(findClosestColorToken(ds, "#7aa2f7")).toEqual({ token: "primary", value: "#7aa2f7", distance: 0 });
  });
  it("returns the nearest token by RGB distance", () => {
    const r = findClosestColorToken(ds, "#7ba3f8");
    expect(r?.token).toBe("primary");
    expect(r!.distance).toBeGreaterThan(0);
    expect(r!.distance).toBeLessThan(10);
  });
  it("returns null for empty palettes", () => {
    expect(findClosestColorToken({ ...ds, colors: {} }, "#123456")).toBeNull();
  });
});

describe("tokenColorValues", () => {
  it("returns lowercased hex values", () => {
    expect(tokenColorValues(ds).sort()).toEqual(["#0e1013", "#7aa2f7", "#e0af68"]);
  });
});
