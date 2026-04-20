import type MagicString from "magic-string";
import type { TextEdit } from "./protocol.js";

export interface AnnotateResult {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
}

export interface AnnotateContext {
  /** Project-root-relative file path, forward slashes. */
  filename: string;
}

export interface PropertyEditInput {
  /** Absolute file path. */
  file: string;
  /** The `data-k-loc` line/col of the opening tag. */
  line: number;
  col: number;
  property: string;
  value: string;
  /** Current file contents. */
  source: string;
}

export interface VerifyError {
  message: string;
  line?: number;
  col?: number;
}

export interface DiagnosticLite {
  file: string;
  line?: number;
  col?: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface DiagnosticsChecker {
  id: string;
  /** Run the checker; return every diagnostic it observes. */
  run(projectRoot: string): Promise<DiagnosticLite[]>;
}

export interface FrameworkAdapter {
  /** Human-readable id, e.g. "svelte", "plain-html". */
  id: string;
  /** Returns true if this adapter owns the file. */
  matches(id: string): boolean;
  /** Inject `data-k-loc` attributes. Return null if no changes. */
  annotate(code: string, ctx: AnnotateContext): AnnotateResult | null;
  /** Apply a property edit by rewriting source. Null = adapter declines. */
  applyPropertyEdit(input: PropertyEditInput): { newSource: string; edits: TextEdit[] } | null;
  /** Prompts injected into the Claude CLI dispatch for this adapter. */
  prompts: {
    /** System prompt for "change this element" requests. */
    change: string;
    /** System prompt for "extract to component" requests. */
    extract: string;
  };
  /** Suggested file extension for newly extracted components. */
  componentExtension: string;
  /**
   * Optional: validate post-edit content for files this adapter owns.
   * Return null if valid, or a VerifyError describing the syntax problem.
   * If omitted, the server falls back to a generic TS/JS check by extension.
   */
  verifySyntax?(file: string, content: string): Promise<VerifyError | null> | VerifyError | null;
  /**
   * Optional: return a project-wide diagnostics checker.
   * If omitted, the adapter contributes no Tier 2 diagnostics.
   */
  createDiagnosticsChecker?(projectRoot: string): DiagnosticsChecker | null;
}
