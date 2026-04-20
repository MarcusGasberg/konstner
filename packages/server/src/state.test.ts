import { describe, it, expect } from "vitest";
import type { PendingRequest, TextEdit } from "@konstner/core";
import { ShellState } from "./state.js";

function makeReq(id: string, prompt = "do thing"): PendingRequest {
  return {
    id,
    kind: "prompt",
    createdAt: 1,
    selection: null,
    prompt,
    path: "/",
  };
}

function edit(file: string, newText = "x"): TextEdit {
  return {
    file,
    startLine: 1,
    startCol: 0,
    endLine: 1,
    endCol: 0,
    newText,
  };
}

const fakeRead = (content: Map<string, string>) => async (f: string) => {
  const c = content.get(f);
  if (c === undefined) throw new Error(`no fake file ${f}`);
  return c;
};

describe("ShellState thread tracking", () => {
  it("enqueue starts a thread for the root request", () => {
    const s = new ShellState();
    s.enqueue(makeReq("r1"));
    const t = s.getThreadForRequest("r1");
    expect(t).not.toBeNull();
    expect(t?.threadId).toBe("r1");
    expect(t?.requestIds).toEqual(["r1"]);
  });

  it("captures the pre-edit snapshot only on the first touch per file", async () => {
    const s = new ShellState();
    s.enqueue(makeReq("r1"));
    const files = new Map([
      ["/a.ts", "original-a"],
      ["/b.ts", "original-b"],
    ]);
    await s.recordThreadEdits("r1", [edit("/a.ts", "v1")], fakeRead(files));
    // Simulate disk change between edits
    files.set("/a.ts", "modified-once");
    await s.recordThreadEdits("r1", [edit("/a.ts", "v2"), edit("/b.ts", "x")], fakeRead(files));

    const t = s.getThreadForRequest("r1")!;
    expect(t.snapshots.get("/a.ts")).toBe("original-a");
    expect(t.snapshots.get("/b.ts")).toBe("original-b");
    expect(t.edits.length).toBe(3);
  });

  it("linkContinuation shares the thread and snapshots", async () => {
    const s = new ShellState();
    s.enqueue(makeReq("r1"));
    const files = new Map([["/a.ts", "orig"]]);
    await s.recordThreadEdits("r1", [edit("/a.ts")], fakeRead(files));

    s.linkContinuation("r1", "r2");
    expect(s.getThreadForRequest("r2")?.threadId).toBe("r1");

    const continuationFiles = new Map([
      ["/a.ts", "after-r1"],
      ["/b.ts", "orig-b"],
    ]);
    await s.recordThreadEdits(
      "r2",
      [edit("/a.ts", "v2"), edit("/b.ts")],
      fakeRead(continuationFiles),
    );

    const t = s.getThread("r1")!;
    // r1's original snapshot for /a.ts must not be overwritten by r2
    expect(t.snapshots.get("/a.ts")).toBe("orig");
    expect(t.snapshots.get("/b.ts")).toBe("orig-b");
  });

  it("revertThread returns the snapshots and marks the thread reverted", async () => {
    const s = new ShellState();
    s.enqueue(makeReq("r1"));
    await s.recordThreadEdits("r1", [edit("/a.ts")], fakeRead(new Map([["/a.ts", "orig"]])));
    const snaps = s.revertThread("r1");
    expect(snaps?.get("/a.ts")).toBe("orig");
    expect(s.getThread("r1")?.status).toBe("reverted");
  });

  it("resolve stores selection/path/prompt on the resolved record", () => {
    const s = new ShellState();
    s.enqueue(makeReq("r1", "first"));
    s.resolve("r1", "done");
    const r = s.findResolved("r1");
    expect(r?.summary).toBe("done");
    expect(r?.prompt).toBe("first");
    expect(r?.threadId).toBe("r1");
  });

  it("threadHasActiveRequest reflects pending queue", () => {
    const s = new ShellState();
    s.enqueue(makeReq("r1"));
    expect(s.threadHasActiveRequest("r1")).toBe(true);
    s.resolve("r1", "done");
    expect(s.threadHasActiveRequest("r1")).toBe(false);
  });
});
