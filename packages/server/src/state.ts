import { readFile } from "node:fs/promises";
import type {
  ElementSelection,
  PendingRequest,
  TextEdit,
  DesignFlag,
} from "@konstner/core";
import type { DesignSystem } from "./designmd/index.js";

export interface DesignFindingLite {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  file?: string;
}

export interface ResolvedRequest {
  id: string;
  threadId: string;
  summary: string;
  resolvedAt: number;
  selection: PendingRequest["selection"];
  path: string | undefined;
  prompt: string | undefined;
}

export interface ThreadRecord {
  threadId: string;
  requestIds: string[];
  snapshots: Map<string, string>;
  edits: TextEdit[];
  status: "active" | "resolved" | "reverted";
  summary?: string;
  designFindings: DesignFindingLite[];
  autoFixIterations: number;
}

export class ShellState {
  currentSelection: ElementSelection | null = null;
  pending: PendingRequest[] = [];
  resolved: ResolvedRequest[] = [];
  recentEdits: TextEdit[] = [];
  threads = new Map<string, ThreadRecord>();
  requestToThread = new Map<string, string>();
  designSystem: DesignSystem | null = null;
  private pendingRuntimeFlags: DesignFlag[] = [];

  setDesignSystem(ds: DesignSystem | null) {
    this.designSystem = ds;
  }

  setSelection(sel: ElementSelection | null) {
    this.currentSelection = sel;
    this.pendingRuntimeFlags = sel?.designFlags ?? [];
  }

  enqueue(req: PendingRequest) {
    this.pending.push(req);
    if (!this.requestToThread.has(req.id)) {
      this.startThread(req.id);
    }
    // Attach runtime flags from the current selection to this request's thread
    if (this.pendingRuntimeFlags.length > 0) {
      const sel = Array.isArray(req.selection) ? req.selection[0] : req.selection;
      const flags = sel?.designFlags ?? this.pendingRuntimeFlags;
      if (flags.length > 0) {
        this.recordRuntimeDesignFindings(req.id, flags);
      }
    }
  }

  startThread(rootId: string): ThreadRecord {
    const existing = this.threads.get(rootId);
    if (existing) return existing;
    const rec: ThreadRecord = {
      threadId: rootId,
      requestIds: [rootId],
      snapshots: new Map(),
      edits: [],
      status: "active",
      designFindings: [],
      autoFixIterations: 0,
    };
    this.threads.set(rootId, rec);
    this.requestToThread.set(rootId, rootId);
    return rec;
  }

  linkContinuation(parentId: string, childId: string): string {
    const threadId = this.requestToThread.get(parentId) ?? parentId;
    let rec = this.threads.get(threadId);
    if (!rec) rec = this.startThread(threadId);
    rec.requestIds.push(childId);
    rec.status = "active";
    this.requestToThread.set(childId, threadId);
    return threadId;
  }

  getThreadForRequest(requestId: string): ThreadRecord | null {
    const tid = this.requestToThread.get(requestId);
    if (!tid) return null;
    return this.threads.get(tid) ?? null;
  }

  async recordThreadEdits(
    requestId: string | undefined,
    edits: TextEdit[],
    read: (file: string) => Promise<string> = (f) => readFile(f, "utf8"),
  ): Promise<void> {
    if (!requestId) return;
    const rec = this.getThreadForRequest(requestId);
    if (!rec) return;
    const files = new Set(edits.map((e) => e.file));
    for (const file of files) {
      if (!rec.snapshots.has(file)) {
        try {
          const content = await read(file);
          rec.snapshots.set(file, content);
        } catch {
          // if the file cannot be read, skip — revert will simply not restore it
        }
      }
    }
    rec.edits.push(...edits);
  }

  resolve(id: string, summary: string): PendingRequest | null {
    const idx = this.pending.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const [req] = this.pending.splice(idx, 1);
    const threadId = this.requestToThread.get(id) ?? id;
    const sel = req.selection ?? null;
    this.resolved.push({
      id,
      threadId,
      summary,
      resolvedAt: Date.now(),
      selection: sel,
      path: req.path,
      prompt: req.prompt,
    });
    const rec = this.threads.get(threadId);
    if (rec) {
      rec.summary = summary;
      if (rec.status !== "reverted") rec.status = "resolved";
    }
    return req;
  }

  findResolved(id: string): ResolvedRequest | null {
    return this.resolved.find((r) => r.id === id) ?? null;
  }

  getThread(threadId: string): ThreadRecord | null {
    return this.threads.get(threadId) ?? null;
  }

  revertThread(threadId: string): Map<string, string> | null {
    const rec = this.threads.get(threadId);
    if (!rec) return null;
    const snapshots = rec.snapshots;
    rec.status = "reverted";
    rec.snapshots = new Map();
    rec.edits = [];
    return snapshots;
  }

  threadHasActiveRequest(threadId: string): boolean {
    const rec = this.threads.get(threadId);
    if (!rec) return false;
    return rec.requestIds.some((id) => this.pending.some((p) => p.id === id));
  }

  recordDesignFindings(requestId: string, findings: DesignFindingLite[]) {
    const rec = this.getThreadForRequest(requestId);
    if (!rec) return;
    rec.designFindings.push(...findings);
  }

  recordRuntimeDesignFindings(requestId: string, flags: DesignFlag[]) {
    const rec = this.getThreadForRequest(requestId);
    if (!rec) return;
    for (const f of flags) {
      // Deduplicate: don't add the same rule twice
      const exists = rec.designFindings.some(
        (df) => df.rule === f.rule && df.message === f.message,
      );
      if (!exists) {
        rec.designFindings.push({
          rule: f.rule,
          severity: f.severity,
          message: f.message,
        });
      }
    }
  }

  clearDesignFindings(requestId: string) {
    const rec = this.getThreadForRequest(requestId);
    if (!rec) return;
    rec.designFindings = [];
  }

  incrementAutoFixIteration(requestId: string): number {
    const rec = this.getThreadForRequest(requestId);
    if (!rec) return 0;
    rec.autoFixIterations++;
    return rec.autoFixIterations;
  }

  getAutoFixIteration(requestId: string): number {
    const rec = this.getThreadForRequest(requestId);
    return rec?.autoFixIterations ?? 0;
  }

  recordEdits(edits: TextEdit[]) {
    this.recentEdits.push(...edits);
    if (this.recentEdits.length > 200) {
      this.recentEdits.splice(0, this.recentEdits.length - 200);
    }
  }
}
