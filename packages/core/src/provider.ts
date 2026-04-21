import type { PendingRequest, TextEdit } from "./protocol.js";

export interface ContinuationContext {
  threadId: string;
  parentId: string;
  previousPrompt?: string;
  previousSummary?: string;
  previousEdits: TextEdit[];
}

/**
 * Canonical tool identifiers used in system prompts before per-provider
 * name substitution. Providers implement `formatToolName` to translate
 * these to the concrete names their runtime exposes.
 *
 * - `konstner.<name>`  — tools served by the konstner MCP bridge
 * - `builtin.<Name>`   — provider-builtin tools (Read/Glob/Grep/Write/Edit/Bash)
 */
export type CanonicalToolId =
  | "konstner.get_selection"
  | "konstner.apply_text_edit"
  | "konstner.resolve_request"
  | "konstner.list_pending_requests"
  | "konstner.get_recent_edits"
  | "konstner.check_design"
  | "builtin.Read"
  | "builtin.Glob"
  | "builtin.Grep"
  | "builtin.Write"
  | "builtin.Edit"
  | "builtin.Bash.mkdir";

export interface ProviderDispatchInput {
  req: PendingRequest;
  cwd: string;
  port: number;
  requestId: string;
  kind: PendingRequest["kind"];
  /** Already templated — canonical tool placeholders substituted for this provider. */
  systemPrompt: string;
  /** Provider-neutral user block with request details. */
  userBlock: string;
  /** Canonical tool IDs this dispatch is allowed to invoke. */
  allowedTools: CanonicalToolId[];
  continuation?: ContinuationContext;
  onLog?: (line: string) => void;
}

export interface ProviderHandle {
  /** Resolves when the provider process finishes (success or error). */
  done: Promise<{ code: number | null }>;
  /** Abort a running dispatch (user cancelled). */
  cancel(): void;
}

export interface ProviderPrepareContext {
  projectRoot: string;
  port: number;
}

export interface ProviderAdapter {
  /** Short stable id, e.g. "claude", "opencode". */
  id: string;
  /** Human-readable name for logs/UI. */
  displayName: string;
  /**
   * Called once at sidecar startup. Use to prepare provider-specific config
   * files (e.g. write `.opencode/agents/*.md`, merge `opencode.json`).
   */
  prepare?(ctx: ProviderPrepareContext): Promise<void>;
  /** Produce the concrete tool name this provider uses for a canonical id. */
  formatToolName(canonical: CanonicalToolId): string;
  /** Spawn the provider runtime for a single request. */
  dispatch(input: ProviderDispatchInput): ProviderHandle;
}
