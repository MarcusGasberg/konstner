import { describe, it, expect, vi } from "vitest";
import type { ElementSelection } from "@konstner/core";
import { createHistoryStore } from "./history.svelte.js";

function makeSel(kLocId = "k1"): ElementSelection {
  return {
    kLocId,
    loc: { file: "App.svelte", line: 10, col: 2 },
    tagName: "button",
    outerHTML: "<button></button>",
    computedStyles: {},
    ancestors: [],
  };
}

describe("history store", () => {
  it("submit adds a loading prompt entry and sends request_change", () => {
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    const sel = makeSel();
    s.submit({ prompt: "make it red", selection: sel, path: "/" });
    expect(send).toHaveBeenCalledWith({
      type: "request_change",
      id: "req_1",
      selection: sel,
      prompt: "make it red",
      path: "/",
    });
    expect(s.threads).toHaveLength(1);
    const t = s.threads[0];
    expect(t.root.status).toBe("loading");
    expect(t.root.prompt).toBe("make it red");
    expect(t.busy).toBe(true);
  });

  it("extract adds a loading extract entry and sends request_extract", () => {
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_2" });
    const sel = makeSel();
    s.extract({ selection: sel, name: "Card" });
    expect(send).toHaveBeenCalledWith({
      type: "request_extract",
      id: "req_2",
      selection: [sel],
      suggestedName: "Card",
    });
    expect(s.threads[0].root.kind).toBe("extract");
    expect(s.threads[0].root.prompt).toBe("Extract → Card");
  });

  it("handleResolved flips loading → done and records summary", () => {
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    s.submit({ prompt: "p", selection: null, path: "/" });
    s.handleResolved({ id: "req_1", summary: "all good" });
    expect(s.threads[0].root.status).toBe("done");
    expect(s.threads[0].root.summary).toBe("all good");
  });

  it("continue adds a follow-up turn on the same thread", () => {
    const send = vi.fn();
    let n = 0;
    const s = createHistoryStore({ send, idGen: () => `req_${++n}` });
    s.submit({ prompt: "first", selection: null, path: "/" });
    const parentId = s.threads[0].root.id;
    s.continueThread(parentId, "second");
    expect(send).toHaveBeenLastCalledWith({
      type: "request_continue",
      id: "req_2",
      parentId,
      prompt: "second",
    });
    expect(s.threads).toHaveLength(1);
    expect(s.threads[0].turns).toHaveLength(2);
    expect(s.threads[0].turns[1].prompt).toBe("second");
  });

  it("requestRevert sets reverting flag, times out after 10s", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    s.submit({ prompt: "p", selection: null, path: "/" });
    s.handleResolved({ id: "req_1", summary: "ok" });
    const tid = s.threads[0].root.threadId;
    s.requestRevert(tid);
    expect(s.threads[0].reverting).toBe(true);
    expect(send).toHaveBeenLastCalledWith({ type: "request_revert", threadId: tid });
    vi.advanceTimersByTime(10001);
    expect(s.threads[0].reverting).toBe(false);
    vi.useRealTimers();
  });

  it("handleReverted marks every entry in the thread as reverted", () => {
    const send = vi.fn();
    let n = 0;
    const s = createHistoryStore({ send, idGen: () => `req_${++n}` });
    s.submit({ prompt: "first", selection: null, path: "/" });
    s.continueThread(s.threads[0].root.id, "second");
    const tid = s.threads[0].root.threadId;
    s.handleReverted({ threadId: tid, files: ["a.svelte"] });
    for (const turn of s.threads[0].turns) {
      expect(turn.status).toBe("reverted");
    }
    expect(s.threads[0].reverted).toBe(true);
  });

  it("confirmRevert toggles on then off after 3s", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    s.submit({ prompt: "p", selection: null, path: "/" });
    s.handleResolved({ id: "req_1", summary: "ok" });
    const tid = s.threads[0].root.threadId;
    s.confirmRevert(tid);
    expect(s.threads[0].confirming).toBe(true);
    vi.advanceTimersByTime(3001);
    expect(s.threads[0].confirming).toBe(false);
    vi.useRealTimers();
  });

  it("openContinue / closeContinue flag on a thread", () => {
    const send = vi.fn();
    const s = createHistoryStore({ send, idGen: () => "req_1" });
    s.submit({ prompt: "p", selection: null, path: "/" });
    const tid = s.threads[0].root.threadId;
    s.openContinue(tid);
    expect(s.threads[0].continueOpen).toBe(true);
    s.closeContinue(tid);
    expect(s.threads[0].continueOpen).toBe(false);
  });

  it("threads are ordered newest first", () => {
    const send = vi.fn();
    let n = 0;
    const s = createHistoryStore({ send, idGen: () => `req_${++n}` });
    s.submit({ prompt: "first", selection: null, path: "/" });
    s.submit({ prompt: "second", selection: null, path: "/" });
    expect(s.threads[0].root.prompt).toBe("second");
    expect(s.threads[1].root.prompt).toBe("first");
  });
});
