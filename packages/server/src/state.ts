import type {
  ElementSelection,
  PendingRequest,
  TextEdit,
} from "@konstner/core";

export interface ResolvedRequest {
  id: string;
  summary: string;
  resolvedAt: number;
}

export class ShellState {
  currentSelection: ElementSelection | null = null;
  pending: PendingRequest[] = [];
  resolved: ResolvedRequest[] = [];
  recentEdits: TextEdit[] = [];

  setSelection(sel: ElementSelection | null) {
    this.currentSelection = sel;
  }

  enqueue(req: PendingRequest) {
    this.pending.push(req);
  }

  resolve(id: string, summary: string): PendingRequest | null {
    const idx = this.pending.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const [req] = this.pending.splice(idx, 1);
    this.resolved.push({ id, summary, resolvedAt: Date.now() });
    return req;
  }

  recordEdits(edits: TextEdit[]) {
    this.recentEdits.push(...edits);
    if (this.recentEdits.length > 200) {
      this.recentEdits.splice(0, this.recentEdits.length - 200);
    }
  }
}
