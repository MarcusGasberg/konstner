import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDesignSystem } from "./index.js";

async function withTempProject(design: string | null): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "konstner-dmd-"));
  if (design !== null) await writeFile(join(dir, "DESIGN.md"), design, "utf8");
  return dir;
}

describe("loadDesignSystem", () => {
  it("returns null when DESIGN.md is absent", async () => {
    const dir = await withTempProject(null);
    try {
      const ds = await loadDesignSystem(dir);
      expect(ds).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("parses front matter tokens and prose", async () => {
    const dir = await withTempProject(
      `---\nname: Demo\ncolors:\n  primary: "#7aa2f7"\n  background: "#0e1013"\ntypography:\n  body:\n    fontFamily: "IBM Plex Sans"\n    fontSize: "16px"\n---\n\n# Demo\n\nProse body.\n`,
    );
    try {
      const ds = await loadDesignSystem(dir);
      expect(ds).not.toBeNull();
      expect(ds!.name).toBe("Demo");
      expect(ds!.colors.primary).toBe("#7aa2f7");
      expect(ds!.typography.body.fontFamily).toBe("IBM Plex Sans");
      expect(ds!.sourcePath).toBe(join(dir, "DESIGN.md"));
      expect(ds!.raw).toContain("Prose body.");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("surfaces lint findings from @google/design.md", async () => {
    const dir = await withTempProject(
      `---\nname: Broken\ncolors:\n  primary: "#000000"\ncomponents:\n  btn:\n    backgroundColor: "{colors.nonexistent}"\n---\n`,
    );
    try {
      const ds = await loadDesignSystem(dir);
      expect(ds).not.toBeNull();
      const brokenRef = ds!.findings.find((f) => f.rule === "broken-ref");
      expect(brokenRef).toBeDefined();
      expect(brokenRef!.severity).toBe("error");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
