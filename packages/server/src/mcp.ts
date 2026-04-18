#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_PORT } from "@konstner/core";

const port = Number(process.env.KONSTNER_PORT ?? DEFAULT_PORT);
const endpoint = `http://127.0.0.1:${port}/rpc`;

async function rpc(method: string, params?: unknown): Promise<unknown> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params }),
  });
  const body = (await res.json()) as { ok: boolean; result?: unknown; error?: string };
  if (!body.ok) throw new Error(body.error ?? "rpc failed");
  return body.result;
}

const server = new Server(
  { name: "konstner", version: "0.0.0" },
  { capabilities: { tools: {} } },
);

const tools = [
  {
    name: "get_selection",
    description:
      "Return the element currently selected in the Konstner overlay. Includes source file/line/col, tag, outerHTML, computed styles, and ancestor chain.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_pending_requests",
    description:
      "List user-initiated design requests queued from the overlay (prompts and component-extraction asks). Each request carries its selection payload.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "resolve_request",
    description:
      "Mark a queued request as done with a short summary that the overlay will surface as a toast.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        summary: { type: "string" },
      },
      required: ["id", "summary"],
    },
  },
  {
    name: "apply_text_edit",
    description:
      "Apply one or more line/column-based text edits to source files. Edits are applied in-process using magic-string; HMR will reload the app.",
    inputSchema: {
      type: "object",
      properties: {
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              file: { type: "string" },
              startLine: { type: "number" },
              startCol: { type: "number" },
              endLine: { type: "number" },
              endCol: { type: "number" },
              newText: { type: "string" },
            },
            required: [
              "file",
              "startLine",
              "startCol",
              "endLine",
              "endCol",
              "newText",
            ],
          },
        },
      },
      required: ["edits"],
    },
  },
  {
    name: "get_recent_edits",
    description:
      "Return recent text edits applied through Konstner (for audit / undo context).",
    inputSchema: { type: "object", properties: {} },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const result = await rpc(name, args);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

await server.connect(new StdioServerTransport());
