import { extname } from "node:path";
import type { FrameworkAdapter, TextEdit } from "@konstner/core";

export interface VerifyFailure {
  file: string;
  message: string;
  line?: number;
  col?: number;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: VerifyFailure };

/**
 * Verify post-edit file content. Delegates to the first adapter that matches
 * and provides `verifySyntax`; otherwise falls back to generic TS/JS parsing
 * (via esbuild) for known extensions. Unknown extensions pass through.
 */
export async function verifyFileSyntax(
  file: string,
  content: string,
  adapters: FrameworkAdapter[],
): Promise<VerifyResult> {
  try {
    const adapter = adapters.find((a) => a.matches(file) && a.verifySyntax);
    if (adapter?.verifySyntax) {
      const err = await adapter.verifySyntax(file, content);
      return err ? { ok: false, error: { file, ...err } } : { ok: true };
    }
    return await genericTsJsCheck(file, content);
  } catch (err) {
    return { ok: false, error: { file, message: (err as Error).message ?? String(err) } };
  }
}

async function genericTsJsCheck(file: string, content: string): Promise<VerifyResult> {
  const ext = extname(file).toLowerCase();
  const loaderFor: Record<string, string> = {
    ".ts": "ts",
    ".tsx": "tsx",
    ".mts": "ts",
    ".cts": "ts",
    ".js": "js",
    ".jsx": "jsx",
    ".mjs": "js",
    ".cjs": "js",
  };
  const loader = loaderFor[ext];
  if (!loader) return { ok: true };
  try {
    const esbuild = await import("esbuild").catch(() => null);
    if (!esbuild) return { ok: true };
    await esbuild.transform(content, { loader: loader as "ts", sourcefile: file, sourcemap: false });
    return { ok: true };
  } catch (err) {
    const e = err as { errors?: Array<{ text?: string; location?: { line?: number; column?: number } }>; message?: string };
    if (e?.errors?.length) {
      const first = e.errors[0];
      return {
        ok: false,
        error: {
          file,
          message: first.text ?? e.message ?? "syntax error",
          line: first.location?.line,
          col: first.location?.column,
        },
      };
    }
    return { ok: false, error: { file, message: e?.message ?? String(err) } };
  }
}

/**
 * Heuristic: does the edit touch an "exported surface" that would make the
 * change visible to other files? This decides whether Tier 2 diagnostics run
 * project-wide or only against the edited files.
 *
 * Framework-agnostic: scans touched lines for common export markers across
 * JS/TS/JSX/Vue/Svelte. Over-triggering is acceptable — a false project check
 * is just a few extra ms of work.
 */
const EXPORT_MARKERS = [
  /\bexport\b/,
  /\bexport\s+let\b/,
  /\$props\s*\(/,
  /\$bindable\s*\(/,
  /<slot\b/,
  /\{@render\b/,
  /defineProps\s*[<(]/,
  /defineExpose\s*\(/,
  /defineEmits\s*[<(]/,
];

export function touchesExportedSurface(
  _file: string,
  edits: TextEdit[],
  newContent: string,
): boolean {
  const lines = newContent.split("\n");
  for (const e of edits) {
    const start = Math.max(0, e.startLine - 1);
    const end = Math.min(lines.length - 1, e.endLine - 1);
    for (let i = start; i <= end; i++) {
      const line = lines[i] ?? "";
      for (const re of EXPORT_MARKERS) if (re.test(line)) return true;
    }
  }
  return false;
}
