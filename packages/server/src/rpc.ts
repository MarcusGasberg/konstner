import type { ElementSelection, PendingRequest, TextEdit } from "@konstner/core";

export interface RpcRequest {
  method:
    | "get_selection"
    | "list_pending_requests"
    | "resolve_request"
    | "apply_text_edit"
    | "get_recent_edits"
    | "check_design";
  params?: unknown;
  requestId?: string;
}

export interface CheckDesignParams {
  file: string;
}

export interface CheckDesignResult {
  findings: Array<{
    rule: string;
    severity: "error" | "warning" | "info";
    message: string;
    line?: number;
    col?: number;
  }>;
}

export interface GetSelectionResult {
  selection: ElementSelection | null;
}

export interface ListPendingResult {
  requests: PendingRequest[];
}

export interface ResolveParams {
  id: string;
  summary: string;
}

export interface ApplyEditParams {
  edits: TextEdit[];
}

export interface RecentEditsResult {
  edits: TextEdit[];
}
