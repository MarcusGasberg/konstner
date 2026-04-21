import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { createClaudeProvider } from "./claude.js";
import { dispatchRequest } from "../dispatch.js";
import type { PendingRequest } from "@konstner/core";

function makeFakeChild(): ChildProcess {
  const ee = new EventEmitter() as ChildProcess;
  (ee as unknown as { stdout: EventEmitter }).stdout = new EventEmitter();
  (ee as unknown as { stderr: EventEmitter }).stderr = new EventEmitter();
  (ee as unknown as { killed: boolean }).killed = false;
  (ee as unknown as { kill: () => void }).kill = () => {
    (ee as unknown as { killed: boolean }).killed = true;
  };
  return ee;
}

function makeRequest(overrides: Partial<PendingRequest> = {}): PendingRequest {
  return {
    id: "req-1",
    kind: "prompt",
    createdAt: 1,
    selection: {
      kLocId: "k1",
      loc: { file: "src/App.svelte", line: 10, col: 2 },
      tagName: "div",
      outerHTML: "<div/>",
      computedStyles: {},
      ancestors: [],
    },
    prompt: "make it red",
    ...overrides,
  };
}

describe("claude provider", () => {
  it("formats canonical konstner tools as mcp__konstner__<name>", () => {
    const p = createClaudeProvider();
    expect(p.formatToolName("konstner.apply_text_edit")).toBe(
      "mcp__konstner__apply_text_edit",
    );
    expect(p.formatToolName("konstner.resolve_request")).toBe(
      "mcp__konstner__resolve_request",
    );
  });

  it("formats builtins preserving case; Bash.mkdir maps to Bash(mkdir:*)", () => {
    const p = createClaudeProvider();
    expect(p.formatToolName("builtin.Read")).toBe("Read");
    expect(p.formatToolName("builtin.Glob")).toBe("Glob");
    expect(p.formatToolName("builtin.Bash.mkdir")).toBe("Bash(mkdir:*)");
  });

  it("dispatches with expected CLI args for prompt kind", () => {
    const spawnImpl = vi.fn().mockReturnValue(makeFakeChild());
    const provider = createClaudeProvider({ spawnImpl: spawnImpl as never });
    dispatchRequest(makeRequest(), {
      provider,
      cwd: "/tmp/proj",
      port: 5177,
    });

    expect(spawnImpl).toHaveBeenCalledTimes(1);
    const [bin, args, spawnOpts] = spawnImpl.mock.calls[0];
    expect(bin).toBe("claude");
    expect(args[0]).toBe("-p");
    expect(args[2]).toBe("--append-system-prompt");
    expect(args[3]).toContain("mcp__konstner__apply_text_edit");
    expect(args[3]).not.toContain("{{tool:");
    expect(args).toContain("--permission-mode");
    expect(args).toContain("acceptEdits");
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(args).toContain("--verbose");
    const toolsArg = args[args.indexOf("--allowedTools") + 1];
    expect(toolsArg.split(",")).toContain("mcp__konstner__apply_text_edit");
    expect(toolsArg.split(",")).toContain("Read");
    expect(spawnOpts.cwd).toBe("/tmp/proj");
    expect(spawnOpts.env.KONSTNER_PORT).toBe("5177");
    expect(spawnOpts.env.KONSTNER_REQUEST_ID).toBe("req-1");
  });

  it("adds Write/Edit/Bash(mkdir:*) to allowedTools for extract kind", () => {
    const spawnImpl = vi.fn().mockReturnValue(makeFakeChild());
    const provider = createClaudeProvider({ spawnImpl: spawnImpl as never });
    dispatchRequest(
      makeRequest({ kind: "extract", suggestedName: "Card" }),
      { provider, cwd: "/tmp/proj", port: 5177 },
    );
    const args = spawnImpl.mock.calls[0][1] as string[];
    const toolsArg = args[args.indexOf("--allowedTools") + 1];
    const tools = toolsArg.split(",");
    expect(tools).toContain("Write");
    expect(tools).toContain("Edit");
    expect(tools).toContain("Bash(mkdir:*)");
  });

  it("resolves done promise on child exit", async () => {
    const fake = makeFakeChild();
    const spawnImpl = vi.fn().mockReturnValue(fake);
    const provider = createClaudeProvider({ spawnImpl: spawnImpl as never });
    const handle = dispatchRequest(makeRequest(), {
      provider,
      cwd: "/tmp",
      port: 1,
    });
    (fake as unknown as EventEmitter).emit("exit", 0);
    await expect(handle.done).resolves.toEqual({ code: 0 });
  });

  it("cancel() sends SIGINT to the child", () => {
    const fake = makeFakeChild();
    const killSpy = vi.fn();
    (fake as unknown as { kill: (s: string) => void }).kill = killSpy;
    const spawnImpl = vi.fn().mockReturnValue(fake);
    const provider = createClaudeProvider({ spawnImpl: spawnImpl as never });
    const handle = dispatchRequest(makeRequest(), {
      provider,
      cwd: "/tmp",
      port: 1,
    });
    handle.cancel();
    expect(killSpy).toHaveBeenCalledWith("SIGINT");
  });
});
