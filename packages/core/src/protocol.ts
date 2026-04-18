import { z } from "zod";

export const SourceLoc = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
});
export type SourceLoc = z.infer<typeof SourceLoc>;

export const ElementSelection = z.object({
  kLocId: z.string(),
  loc: SourceLoc.nullable(),
  tagName: z.string(),
  outerHTML: z.string(),
  computedStyles: z.record(z.string(), z.string()),
  ancestors: z.array(z.object({ tagName: z.string(), loc: SourceLoc.nullable() })),
});
export type ElementSelection = z.infer<typeof ElementSelection>;

export const PendingRequestKind = z.enum(["prompt", "extract"]);
export type PendingRequestKind = z.infer<typeof PendingRequestKind>;

export const PendingRequest = z.object({
  id: z.string(),
  kind: PendingRequestKind,
  createdAt: z.number().int().nonnegative(),
  selection: z.union([ElementSelection, z.array(ElementSelection)]),
  prompt: z.string().optional(),
  suggestedName: z.string().optional(),
});
export type PendingRequest = z.infer<typeof PendingRequest>;

export const TextEdit = z.object({
  file: z.string(),
  startLine: z.number().int().nonnegative(),
  startCol: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  endCol: z.number().int().nonnegative(),
  newText: z.string(),
});
export type TextEdit = z.infer<typeof TextEdit>;

export const ClientToServer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), clientId: z.string() }),
  z.object({ type: z.literal("selection_changed"), selection: ElementSelection.nullable() }),
  z.object({ type: z.literal("request_change"), id: z.string(), selection: ElementSelection, prompt: z.string() }),
  z.object({ type: z.literal("request_extract"), id: z.string(), selection: z.array(ElementSelection), suggestedName: z.string() }),
  z.object({ type: z.literal("apply_property_edit"), selection: ElementSelection, property: z.string(), value: z.string() }),
]);
export type ClientToServer = z.infer<typeof ClientToServer>;

export const ServerToClient = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello_ack"), serverVersion: z.string() }),
  z.object({ type: z.literal("pending_requests"), requests: z.array(PendingRequest) }),
  z.object({ type: z.literal("request_resolved"), id: z.string(), summary: z.string() }),
  z.object({ type: z.literal("edit_applied"), edits: z.array(TextEdit) }),
  z.object({ type: z.literal("toast"), level: z.enum(["info", "success", "error"]), message: z.string() }),
]);
export type ServerToClient = z.infer<typeof ServerToClient>;

export function parseClientMessage(raw: unknown): ClientToServer { return ClientToServer.parse(raw); }
export function parseServerMessage(raw: unknown): ServerToClient { return ServerToClient.parse(raw); }

export const WS_PATH = "/__konstner__";
export const DEFAULT_PORT = 5177;
