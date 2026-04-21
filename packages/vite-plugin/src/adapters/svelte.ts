import type { DiagnosticLite, DiagnosticsChecker, FrameworkAdapter, VerifyError } from "@konstner/core";
import { createHtmlLikeAnnotator } from "./shared.js";
import { applySveltePropertyEdit } from "@konstner/server/adapters/svelte-rewrite";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ADAPTER_DESIGN_PROMPT } from "./design-prompt.js";

const CHANGE_PROMPT = `You are editing a Svelte 5 component. Preserve <script>/<style> blocks; modify only the requested element's attributes, classes, or children. Use runes when adding state.${ADAPTER_DESIGN_PROMPT}`;
const EXTRACT_PROMPT = `Extract the given subtree into a new Svelte 5 component under src/lib/components/. Use <script lang="ts"> with $props(). Replace the original subtree with an import + usage.${ADAPTER_DESIGN_PROMPT}`;

// Skip components (<Foo>) and svelte: namespaces (<svelte:head>) — we only
// annotate native HTML elements, which in Svelte always start lowercase.
const skipTag = (tagName: string) =>
  /^[A-Z]/.test(tagName) || tagName.includes(":");

async function verifySvelteSyntax(file: string, content: string): Promise<VerifyError | null> {
  try {
    const { parse } = await import("svelte/compiler");
    parse(content, { modern: true, filename: file });
    return null;
  } catch (err) {
    const e = err as { message?: string; start?: { line?: number; column?: number } };
    return {
      message: e.message ?? String(err),
      line: e.start?.line,
      col: e.start?.column,
    };
  }
}

function createSvelteCheckChecker(projectRoot: string): DiagnosticsChecker | null {
  const bin = join(projectRoot, "node_modules", ".bin", "svelte-check");
  if (!existsSync(bin)) return null;
  return {
    id: "svelte-check",
    async run(root) {
      return runSvelteCheck(bin, root);
    },
  };
}

async function runSvelteCheck(bin: string, cwd: string): Promise<DiagnosticLite[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ["--output", "machine"], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (b: Buffer) => (out += b.toString("utf8")));
    child.on("error", reject);
    child.on("exit", () => {
      try { resolve(parseMachineOutput(out)); } catch (e) { reject(e); }
    });
  });
}

function parseMachineOutput(raw: string): DiagnosticLite[] {
  const out: DiagnosticLite[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(
      /^\S+\s+(ERROR|WARNING)\s+"([^"]+)"\s+(\d+)\s+(\d+)\s+"([^"]*)"/,
    );
    if (!match) continue;
    const [, sev, file, ln, col, msg] = match;
    out.push({
      file,
      line: Number(ln) || undefined,
      col: Number(col) || undefined,
      severity: sev === "ERROR" ? "error" : "warning",
      message: msg,
    });
  }
  return out;
}

export function createSvelteAdapter(): FrameworkAdapter {
  return {
    id: "svelte",
    matches: (id) => id.endsWith(".svelte"),
    annotate: createHtmlLikeAnnotator({ skipTag }),
    applyPropertyEdit: applySveltePropertyEdit,
    prompts: { change: CHANGE_PROMPT, extract: EXTRACT_PROMPT },
    componentExtension: ".svelte",
    verifySyntax: verifySvelteSyntax,
    createDiagnosticsChecker: createSvelteCheckChecker,
  };
}
