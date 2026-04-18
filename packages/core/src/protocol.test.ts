import { describe, it, expect } from "vitest";
import {
  type ClientToServer, type ServerToClient, type ElementSelection,
  parseClientMessage, parseServerMessage,
} from "./protocol.js";

const sampleSel: ElementSelection = {
  kLocId: "src/App.svelte:12:4",
  loc: { file: "src/App.svelte", line: 12, col: 4 },
  tagName: "div", outerHTML: "<div></div>",
  computedStyles: { color: "rgb(0, 0, 0)" }, ancestors: [],
};

describe("protocol schemas", () => {
  it("accepts a valid request_change", () => {
    const msg: ClientToServer = { type: "request_change", id: "req_1", selection: sampleSel, prompt: "make it red" };
    expect(parseClientMessage(msg)).toEqual(msg);
  });
  it("rejects an unknown message type", () => {
    expect(() => parseClientMessage({ type: "bogus" })).toThrow();
  });
  it("accepts a server toast", () => {
    const msg: ServerToClient = { type: "toast", level: "error", message: "boom" };
    expect(parseServerMessage(msg)).toEqual(msg);
  });
  it("rejects a toast with bad level", () => {
    expect(() => parseServerMessage({ type: "toast", level: "warning", message: "x" })).toThrow();
  });
});
