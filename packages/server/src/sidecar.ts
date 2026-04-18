import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  DEFAULT_PORT,
  WS_PATH,
  type ClientToServer,
  type ServerToClient,
  type PendingRequest,
} from "@konstner/core";
import { ShellState } from "./state.js";
import { applyTextEdits } from "./edits.js";
import { dispatchRequest } from "./dispatch.js";
import { applySveltePropertyEdit } from "./adapters/svelte-rewrite.js";
import type {
  ApplyEditParams,
  ListPendingResult,
  RecentEditsResult,
  ResolveParams,
  RpcRequest,
  GetSelectionResult,
} from "./rpc.js";

export interface SidecarOptions {
  port?: number;
  projectRoot: string;
}

export interface Sidecar {
  close(): Promise<void>;
  port: number;
}

export async function startSidecar(opts: SidecarOptions): Promise<Sidecar> {
  const port = opts.port ?? DEFAULT_PORT;
  const state = new ShellState();
  const sockets = new Set<WebSocket>();

  const broadcast = (msg: ServerToClient) => {
    const json = JSON.stringify(msg);
    for (const s of sockets) if (s.readyState === s.OPEN) s.send(json);
  };

  const http = createServer(async (req, res) => {
    if (!req.url) return res.end();
    if (req.method === "POST" && req.url === "/rpc") {
      const body = await readBody(req);
      try {
        const rpc = JSON.parse(body) as RpcRequest;
        const result = await handleRpc(rpc);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, result }));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({ ok: false, error: (err as Error).message ?? String(err) }),
        );
      }
      return;
    }
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, pending: state.pending.length }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  async function handleRpc(rpc: RpcRequest): Promise<unknown> {
    switch (rpc.method) {
      case "get_selection": {
        return { selection: state.currentSelection } satisfies GetSelectionResult;
      }
      case "list_pending_requests": {
        return { requests: state.pending } satisfies ListPendingResult;
      }
      case "resolve_request": {
        const p = rpc.params as ResolveParams;
        const req = state.resolve(p.id, p.summary);
        if (req) broadcast({ type: "request_resolved", id: p.id, summary: p.summary });
        return { resolved: !!req };
      }
      case "apply_text_edit": {
        const p = rpc.params as ApplyEditParams;
        await applyTextEdits(p.edits);
        state.recordEdits(p.edits);
        broadcast({ type: "edit_applied", edits: p.edits });
        return { applied: p.edits.length };
      }
      case "get_recent_edits": {
        return { edits: state.recentEdits } satisfies RecentEditsResult;
      }
    }
  }

  const wss = new WebSocketServer({ server: http, path: WS_PATH });
  wss.on("connection", (ws) => {
    sockets.add(ws);
    const hello: ServerToClient = { type: "hello_ack", serverVersion: "0.0.0" };
    ws.send(JSON.stringify(hello));
    ws.on("message", (data) => {
      let msg: ClientToServer;
      try {
        msg = JSON.parse(data.toString()) as ClientToServer;
      } catch {
        return;
      }
      onClientMessage(msg);
    });
    ws.on("close", () => sockets.delete(ws));
  });

  function onClientMessage(msg: ClientToServer) {
    switch (msg.type) {
      case "hello":
        return;
      case "selection_changed":
        state.setSelection(msg.selection);
        return;
      case "request_change": {
        const req: PendingRequest = {
          id: msg.id,
          kind: "prompt",
          createdAt: Date.now(),
          selection: msg.selection,
          prompt: msg.prompt,
        };
        state.enqueue(req);
        broadcast({
          type: "toast",
          level: "info",
          message: `Dispatching to Claude: ${msg.prompt.slice(0, 60)}`,
        });
        dispatchRequest(req, {
          cwd: opts.projectRoot,
          port,
          onLog: (line) => console.log(line),
        });
        return;
      }
      case "request_extract": {
        const req: PendingRequest = {
          id: msg.id,
          kind: "extract",
          createdAt: Date.now(),
          selection: msg.selection,
          suggestedName: msg.suggestedName,
        };
        state.enqueue(req);
        broadcast({
          type: "toast",
          level: "info",
          message: `Dispatching extract: ${msg.suggestedName}`,
        });
        dispatchRequest(req, {
          cwd: opts.projectRoot,
          port,
          onLog: (line) => console.log(line),
        });
        return;
      }
      case "apply_property_edit": {
        const loc = msg.selection.loc;
        if (!loc) {
          broadcast({
            type: "toast",
            level: "error",
            message: "No source location for this element — cannot edit.",
          });
          return;
        }
        applySveltePropertyEdit({
          projectRoot: opts.projectRoot,
          file: loc.file,
          line: loc.line,
          col: loc.col,
          property: msg.property,
          value: msg.value,
        }).then(
          (edits) => {
            state.recordEdits(edits);
            broadcast({ type: "edit_applied", edits });
          },
          (err: Error) => {
            console.error("[sidecar] property edit failed:", err);
            broadcast({
              type: "toast",
              level: "error",
              message: `Property edit failed: ${err.message}`,
            });
          },
        );
        return;
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    http.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `konstner: port ${port} is already in use. A stale sidecar from a previous dev session may still be running; run \`fuser -k ${port}/tcp\` or kill it manually.`,
          ),
        );
      } else {
        reject(err);
      }
    });
    http.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    port,
    async close() {
      await new Promise<void>((r) => wss.close(() => r()));
      await new Promise<void>((r) => http.close(() => r()));
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
