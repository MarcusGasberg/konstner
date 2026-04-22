import { describe, expect, it } from "vitest";
import { checkDesignMdTokens } from "./designmd-rule.js";
import type { DesignSystem } from "../designmd/index.js";

const ds: DesignSystem = {
  name: "t",
  colors: { primary: "#7aa2f7", background: "#0e1013" },
  typography: { body: { fontFamily: "IBM Plex Sans" } },
  rounded: {},
  spacing: {},
  components: {},
  findings: [],
  raw: "",
  sourcePath: "/tmp/DESIGN.md",
};

describe("checkDesignMdTokens", () => {
  it("flags hex colors not present in DESIGN.md tokens", () => {
    const css = `.x { color: #ff00aa; background: #7aa2f7; }`;
    const findings = checkDesignMdTokens(
      {
        filePath: "a.css",
        content: css,
        ext: "css",
        isCss: true,
        isHtmlLike: false,
        isJsxLike: false,
        designSystem: ds,
      },
      [],
    );
    expect(findings.some((f) => f.rule === "design-md-token" && f.message.startsWith("Color #ff00aa"))).toBe(true);
    expect(findings.some((f) => f.message.startsWith("Color #7aa2f7"))).toBe(false);
  });

  it("suggests the closest DESIGN.md token in the message", () => {
    const css = `.x { color: #7ba3f8; }`;
    const findings = checkDesignMdTokens(
      {
        filePath: "a.css",
        content: css,
        ext: "css",
        isCss: true,
        isHtmlLike: false,
        isJsxLike: false,
        designSystem: ds,
      },
      [],
    );
    const f = findings.find((x) => x.rule === "design-md-token");
    expect(f).toBeDefined();
    expect(f!.message).toContain("colors.primary");
    expect(f!.message).toContain("var(--color-primary)");
  });

  it("no-ops when designSystem is null", () => {
    const css = `.x { color: #ff00aa; }`;
    const findings = checkDesignMdTokens(
      {
        filePath: "a.css",
        content: css,
        ext: "css",
        isCss: true,
        isHtmlLike: false,
        isJsxLike: false,
        designSystem: null,
      },
      [],
    );
    expect(findings).toEqual([]);
  });
});
