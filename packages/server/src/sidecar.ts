import { createServer, type IncomingMessage } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { WebSocketServer, WebSocket } from "ws";
import { checkDesign } from "./design-check/index.js";
import {
  loadDesignSystem,
  watchDesignSystem,
  prose as designProse,
} from "./designmd/index.js";
import {
  DEFAULT_PORT,
  WS_PATH,
  type ClientToServer,
  type ServerToClient,
  type PendingRequest,
  type FrameworkAdapter,
  type ProviderAdapter,
} from "@konstner/core";
import { ShellState } from "./state.js";
import { applyTextEdits } from "./edits.js";
import { dispatchRequest, type ContinuationContext } from "./dispatch.js";
import { verifyFileSyntax } from "./verify.js";
import { createDiagnosticsRunner, type DiagnosticsRunner } from "./diagnostics.js";
import type {
  ApplyEditParams,
  ListPendingResult,
  RecentEditsResult,
  ResolveParams,
  RpcRequest,
  GetSelectionResult,
  GetDesignSystemResult,
} from "./rpc.js";

export interface DesignCheckConfig {
  enabled: boolean;
  autoFixMaxLoops: number;
  strict: boolean;
}

export interface SidecarOptions {
  port?: number;
  projectRoot: string;
  /** Adapters used for post-edit syntax verification and Tier 2 diagnostics. */
  adapters?: FrameworkAdapter[];
  /** Design check configuration. */
  designCheck?: DesignCheckConfig;
  /** AI provider that executes dispatched requests. Required. */
  provider: ProviderAdapter;
}

export interface Sidecar {
  close(): Promise<void>;
  port: number;
}

export async function startSidecar(opts: SidecarOptions): Promise<Sidecar> {
  const port = opts.port ?? DEFAULT_PORT;
  const adapters = opts.adapters ?? [];
  const provider = opts.provider;
  await provider.prepare?.({ projectRoot: opts.projectRoot, port });

  /** Dispatch a request and, after the provider process exits, auto-resolve
   *  the request if the model never called resolve_request itself. Prevents
   *  the overlay's "in flight" state from hanging when a model returns
   *  without invoking the resolve MCP tool. */
  function dispatchAndTrack(
    req: PendingRequest,
    continuation?: ContinuationContext,
  ) {
    const handle = dispatchRequest(req, {
      provider,
      cwd: opts.projectRoot,
      port,
      onLog: (line) => console.log(line),
      continuation,
    });
    void handle.done.then(({ code }) => {
      const stillPending = state.pending.some((p) => p.id === req.id);
      if (!stillPending) return;
      const summary =
        code === 0
          ? "Provider exited without calling resolve_request — see logs."
          : `Provider exited with code ${code}.`;
      state.resolve(req.id, summary);
      broadcast({ type: "request_resolved", id: req.id, summary });
      broadcast({
        type: "toast",
        level: code === 0 ? "info" : "error",
        message: summary,
      });
    });
    return handle;
  }
  const designCheck = opts.designCheck ?? { enabled: true, autoFixMaxLoops: 2, strict: false };
  const state = new ShellState();
  const sockets = new Set<WebSocket>();

  state.setDesignSystem(await loadDesignSystem(opts.projectRoot));
  const stopWatchDesign = watchDesignSystem(opts.projectRoot, (ds) => {
    state.setDesignSystem(ds);
    broadcast({
      type: "toast",
      level: "info",
      message: `DESIGN.md reloaded${ds ? "" : " (file removed)"}`,
    });
  });

  const autoFixEnabled = designCheck.enabled && designCheck.autoFixMaxLoops > 0;

  const broadcast = (msg: ServerToClient) => {
    const json = JSON.stringify(msg);
    for (const s of sockets) if (s.readyState === s.OPEN) s.send(json);
  };

  const diagnostics: DiagnosticsRunner = createDiagnosticsRunner({
    projectRoot: opts.projectRoot,
    adapters,
    onResult: (result) => broadcast({ type: "diagnostics", scope: result.scope, added: result.added }),
    onLog: (line) => console.log(line),
  });

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
        if (!req) return { resolved: false };

        // Auto-fix loop: if design findings exist and we haven't exceeded max loops,
        // auto-enqueue a continuation instead of broadcasting resolved.
        if (autoFixEnabled) {
          const thread = state.getThreadForRequest(p.id);
          if (thread) {
            const iteration = state.getAutoFixIteration(p.id);
            const findings = thread.designFindings;
            if (findings.length > 0 && iteration < designCheck.autoFixMaxLoops) {
              const fixable = findings.filter((f) => f.severity === "error" || f.severity === "warning");
              if (fixable.length > 0) {
                state.incrementAutoFixIteration(p.id);
                state.clearDesignFindings(p.id);
                const parentResolved = state.findResolved(p.id);
                if (parentResolved) {
                  const fixId = `auto-fix-${p.id}-${iteration}`;
                  const issues = fixable
                    .map((f) => `- ${f.rule}: ${f.message}${f.file ? ` (${f.file})` : ""}`)
                    .join("\n");
                  const fixPrompt = `The previous edit introduced these design issues:\n${issues}\n\nFix them while preserving the intended change. Make minimal edits.`;
                  const fixReq: PendingRequest = {
                    id: fixId,
                    kind: "prompt",
                    createdAt: Date.now(),
                    selection: parentResolved.selection,
                    prompt: fixPrompt,
                    path: parentResolved.path,
                  };
                  state.linkContinuation(p.id, fixId);
                  state.enqueue(fixReq);
                  const continuation: ContinuationContext = {
                    threadId: thread.threadId,
                    parentId: p.id,
                    previousPrompt: parentResolved.prompt,
                    previousSummary: parentResolved.summary,
                    previousEdits: thread.edits,
                  };
                  dispatchAndTrack(fixReq, continuation);
                  broadcast({
                    type: "toast",
                    level: "info",
                    message: `Auto-fixing ${fixable.length} design issue(s) (loop ${iteration + 1}/${designCheck.autoFixMaxLoops})…`,
                  });
                  return { resolved: true, autoFixTriggered: true };
                }
              }
            }
            // Max loops reached or no fixable issues: clear findings and resolve
            state.clearDesignFindings(p.id);
          }
        }

        broadcast({ type: "request_resolved", id: p.id, summary: p.summary });
        return { resolved: true };
      }
      case "apply_text_edit": {
        const p = rpc.params as ApplyEditParams;
        const attributedId =
          rpc.requestId ??
          (state.pending.length === 1 ? state.pending[0].id : undefined);
        await state.recordThreadEdits(attributedId, p.edits);
        const result = await applyTextEdits(p.edits, adapters);
        if (!result.ok) {
          const summary = result.errors
            .map((e) => `${e.file}${e.line ? `:${e.line}${e.col != null ? `:${e.col}` : ""}` : ""}: ${e.message}`)
            .join("; ");
          throw new Error(
            `edits rejected — post-edit syntax check failed. Re-read the file, adjust your edit, and retry. Details: ${summary}`,
          );
        }
        state.recordEdits(p.edits);
        broadcast({ type: "edit_applied", edits: p.edits });
        diagnostics.schedule({
          files: result.touchedFiles,
          scope: result.exportedSurfaceChanged ? "project" : "file",
        });
        // Run design check on touched files
        if (designCheck.enabled && attributedId) {
          const allFindings: Array<{ rule: string; severity: string; message: string; file: string }> = [];
          for (const file of result.touchedFiles) {
            try {
              const content = await readFile(file, "utf8");
              const findings = checkDesign(file, content, state.designSystem);
              for (const f of findings) {
                allFindings.push({ ...f, file });
              }
            } catch {
              // ignore unreadable files
            }
          }
          if (allFindings.length > 0) {
            state.recordDesignFindings(
              attributedId,
              allFindings.map((f) => ({
                rule: f.rule,
                severity: f.severity as "error" | "warning" | "info",
                message: f.message,
                file: f.file,
              })),
            );
          }
        }
        return { applied: p.edits.length };
      }
      case "get_recent_edits": {
        return { edits: state.recentEdits } satisfies RecentEditsResult;
      }
      case "check_design": {
        const p = rpc.params as { file: string };
        const content = await readFile(p.file, "utf8");
        const findings = checkDesign(p.file, content, state.designSystem);
        return { findings };
      }
      case "get_design_system": {
        const ds = state.designSystem;
        if (!ds) return { designSystem: null } satisfies GetDesignSystemResult;
        return {
          designSystem: {
            name: ds.name,
            description: ds.description,
            colors: ds.colors,
            typography: ds.typography as Record<string, Record<string, string | number>>,
            rounded: ds.rounded,
            spacing: ds.spacing,
            components: ds.components,
            prose: designProse(ds),
            findings: ds.findings,
            sourcePath: ds.sourcePath,
          },
        } satisfies GetDesignSystemResult;
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
          path: msg.path,
        };
        state.enqueue(req);
        dispatchAndTrack(req);
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
        dispatchAndTrack(req);
        return;
      }
      case "request_continue": {
        const parentResolved = state.findResolved(msg.parentId);
        const thread = state.getThreadForRequest(msg.parentId);
        if (!parentResolved || !thread) {
          broadcast({
            type: "toast",
            level: "error",
            message: "Cannot continue: parent request not found.",
          });
          return;
        }
        if (thread.status === "reverted") {
          broadcast({
            type: "toast",
            level: "error",
            message: "Cannot continue a reverted thread.",
          });
          return;
        }
        if (state.threadHasActiveRequest(thread.threadId)) {
          broadcast({
            type: "toast",
            level: "error",
            message: "Thread already has a request in flight.",
          });
          return;
        }
        const req: PendingRequest = {
          id: msg.id,
          kind: "prompt",
          createdAt: Date.now(),
          selection: parentResolved.selection,
          prompt: msg.prompt,
          path: parentResolved.path,
        };
        state.linkContinuation(msg.parentId, msg.id);
        state.enqueue(req);
        const continuation: ContinuationContext = {
          threadId: thread.threadId,
          parentId: msg.parentId,
          previousPrompt: parentResolved.prompt,
          previousSummary: parentResolved.summary,
          previousEdits: thread.edits,
        };
        dispatchAndTrack(req, continuation);
        return;
      }
      case "request_revert": {
        console.log(`[revert] requested for thread ${msg.threadId}`);
        const thread = state.getThread(msg.threadId);
        if (!thread) {
          broadcast({
            type: "toast",
            level: "error",
            message: "Cannot revert: thread not found.",
          });
          return;
        }
        if (state.threadHasActiveRequest(thread.threadId)) {
          broadcast({
            type: "toast",
            level: "error",
            message: "Cannot revert while a request is in flight.",
          });
          return;
        }
        const snapshots = state.revertThread(thread.threadId);
        if (!snapshots || snapshots.size === 0) {
          console.log(`[revert] thread ${thread.threadId} has no snapshots`);
          broadcast({
            type: "toast",
            level: "info",
            message: "Nothing to revert (no snapshots captured for this thread).",
          });
          return;
        }
        console.log(
          `[revert] restoring ${snapshots.size} file(s): ${[...snapshots.keys()].join(", ")}`,
        );
        void (async () => {
          for (const [file, content] of snapshots) {
            const verdict = await verifyFileSyntax(file, content, adapters);
            if (!verdict.ok) {
              broadcast({
                type: "toast",
                level: "error",
                message: `Revert aborted: ${file} failed verification (${verdict.error.message}).`,
              });
              return;
            }
          }
          const files: string[] = [];
          for (const [file, content] of snapshots) {
            await writeFile(file, content, "utf8");
            files.push(file);
          }
          broadcast({ type: "request_reverted", threadId: thread.threadId, files });
          diagnostics.schedule({ files, scope: "file" });
        })();
        return;
      }
      case "scan_page": {
        console.log(`[scan] received ${msg.findings.length} findings from page scan (${msg.id})`);
        if (msg.findings.length > 0) {
          const summary = msg.findings
            .map((f) => `[${f.severity}] ${f.rule}: ${f.message}`)
            .join("\n");
          broadcast({
            type: "toast",
            level: "info",
            message: `Page scan found ${msg.findings.length} design issue(s). See console for details.`,
          });
          console.log(`[scan findings]\n${summary}`);
        } else {
          broadcast({
            type: "toast",
            level: "success",
            message: "Page scan complete. No design issues found.",
          });
        }
        return;
      }
    }
  }

  await new Promise<void>((done, reject) => {
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
    http.listen(port, "127.0.0.1", () => done());
  });

  return {
    port,
    async close() {
      stopWatchDesign();
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
