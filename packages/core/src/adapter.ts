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
}
