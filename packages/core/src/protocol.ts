export interface SourceLoc {
  file: string;
  line: number;
  col: number;
}

export interface ElementSelection {
  kLocId: string;
  loc: SourceLoc | null;
  tagName: string;
  outerHTML: string;
  computedStyles: Record<string, string>;
  ancestors: Array<{ tagName: string; loc: SourceLoc | null }>;
}

export type PendingRequestKind = "prompt" | "extract";

export interface PendingRequest {
  id: string;
  kind: PendingRequestKind;
  createdAt: number;
  selection: ElementSelection | ElementSelection[];
  prompt?: string;
  suggestedName?: string;
}

export interface TextEdit {
  file: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  newText: string;
}

export type ClientToServer =
  | { type: "hello"; clientId: string }
  | { type: "selection_changed"; selection: ElementSelection | null }
  | { type: "request_change"; id: string; selection: ElementSelection; prompt: string }
  | {
      type: "request_extract";
      id: string;
      selection: ElementSelection[];
      suggestedName: string;
    }
  | {
      type: "apply_property_edit";
      selection: ElementSelection;
      property: string;
      value: string;
    };

export type ServerToClient =
  | { type: "hello_ack"; serverVersion: string }
  | { type: "pending_requests"; requests: PendingRequest[] }
  | { type: "request_resolved"; id: string; summary: string }
  | { type: "edit_applied"; edits: TextEdit[] }
  | { type: "toast"; level: "info" | "success" | "error"; message: string };

export const WS_PATH = "/__konstner__";
export const DEFAULT_PORT = 5177;
