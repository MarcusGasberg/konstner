import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import {
  createOpenCodeProvider,
  formatOpenCodeToolName,
  mergeOpenCodeConfig,
  renderAgentMarkdown,
} from "./opencode.js";

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

describe("formatOpenCodeToolName", () => {
  it("maps konstner.<leaf> to konstner_<leaf>", () => {
    expect(formatOpenCodeToolName("konstner.apply_text_edit")).toBe(
      "konstner_apply_text_edit",
    );
    expect(formatOpenCodeToolName("konstner.resolve_request")).toBe(
      "konstner_resolve_request",
    );
  });
  it("lowercases builtin tool names", () => {
    expect(formatOpenCodeToolName("builtin.Read")).toBe("read");
    expect(formatOpenCodeToolName("builtin.Write")).toBe("write");
    expect(formatOpenCodeToolName("builtin.Glob")).toBe("glob");
    expect(formatOpenCodeToolName("builtin.Bash.mkdir")).toBe("bash");
  });
});

describe("mergeOpenCodeConfig", () => {
  it("creates a new config when none exists", () => {
    const out = mergeOpenCodeConfig(null, { type: "local", enabled: true });
    const parsed = JSON.parse(out);
    expect(parsed.$schema).toBe("https://opencode.ai/config.json");
    expect(parsed.mcp.konstner).toEqual({ type: "local", enabled: true });
  });
  it("preserves unrelated keys and other mcp servers", () => {
    const existing = {
      $schema: "custom",
      theme: "dracula",
      mcp: {
        other: { type: "local", enabled: true, command: ["other"] },
      },
    };
    const out = mergeOpenCodeConfig(existing, { type: "local", enabled: true });
    const parsed = JSON.parse(out);
    expect(parsed.theme).toBe("dracula");
    expect(parsed.$schema).toBe("custom");
    expect(parsed.mcp.other).toEqual({
      type: "local",
      enabled: true,
      command: ["other"],
    });
    expect(parsed.mcp.konstner).toEqual({ type: "local", enabled: true });
  });
});

describe("renderAgentMarkdown", () => {
  it("emits frontmatter with tools map and body", () => {
    const md = renderAgentMarkdown({
      description: "desc",
      systemPrompt: "SYSTEM",
      toolGlobs: ["konstner_*", "read"],
    });
    expect(md).toContain("---\ndescription: desc");
    expect(md).toContain('"konstner_*": true');
    expect(md).toContain('"read": true');
    expect(md).toContain("\n\nSYSTEM\n");
  });
});

describe("opencode provider prepare", () => {
  it("writes opencode.json and agent markdown files", async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const writeFileImpl = async (p: string, c: string) => {
      writes.push({ path: p, content: c });
    };
    const readFileImpl = async () => {
      throw new Error("ENOENT");
    };
    const provider = createOpenCodeProvider({
      writeFileImpl,
      readFileImpl,
      mcpCommand: { command: "node", args: ["/abs/mcp.js"] },
    });
    await provider.prepare!({ projectRoot: "/proj", port: 5177 });

    const configWrite = writes.find((w) => w.path.endsWith("opencode.json"))!;
    expect(configWrite).toBeDefined();
    const cfg = JSON.parse(configWrite.content);
    expect(cfg.mcp.konstner).toEqual({
      type: "local",
      enabled: true,
      command: ["node", "/abs/mcp.js"],
      environment: { KONSTNER_PORT: "5177" },
    });

    const promptAgent = writes.find((w) =>
      w.path.endsWith("konstner-prompt.md"),
    );
    const extractAgent = writes.find((w) =>
      w.path.endsWith("konstner-extract.md"),
    );
    expect(promptAgent).toBeDefined();
    expect(extractAgent).toBeDefined();
    expect(extractAgent!.content).toContain('"write": true');
    expect(promptAgent!.content).not.toContain('"write": true');
  });
});

describe("opencode provider dispatch", () => {
  it("spawns `opencode run --agent konstner-prompt …`", async () => {
    const spawnImpl = vi.fn().mockReturnValue(makeFakeChild());
    const provider = createOpenCodeProvider({
      spawnImpl: spawnImpl as never,
      writeFileImpl: async () => {},
      readFileImpl: async () => "{}",
    });
    const handle = provider.dispatch({
      req: { id: "r1", kind: "prompt", createdAt: 1, selection: null },
      cwd: "/proj",
      port: 5177,
      requestId: "r1",
      kind: "prompt",
      systemPrompt: "SYS",
      userBlock: "USER",
      allowedTools: ["konstner.apply_text_edit"],
    });
    // Wait for the internal writeIfChanged + spawn to fire
    await Promise.resolve();
    await Promise.resolve();

    expect(spawnImpl).toHaveBeenCalledTimes(1);
    const [bin, args, opts] = spawnImpl.mock.calls[0];
    expect(bin).toBe("opencode");
    expect(args.slice(0, 6)).toEqual([
      "run",
      "--agent",
      "konstner-prompt",
      "--format",
      "json",
      "USER",
    ]);
    expect(opts.cwd).toBe("/proj");
    expect(opts.env.KONSTNER_PORT).toBe("5177");

    // Exit the fake child to let the handle resolve.
    const fake = spawnImpl.mock.results[0].value as EventEmitter;
    fake.emit("exit", 0);
    await expect(handle.done).resolves.toEqual({ code: 0 });
  });

  it("adds --session when continuation is present", async () => {
    const spawnImpl = vi.fn().mockReturnValue(makeFakeChild());
    const provider = createOpenCodeProvider({
      spawnImpl: spawnImpl as never,
      writeFileImpl: async () => {},
      readFileImpl: async () => "{}",
    });
    provider.dispatch({
      req: { id: "r2", kind: "prompt", createdAt: 1, selection: null },
      cwd: "/proj",
      port: 5177,
      requestId: "r2",
      kind: "prompt",
      systemPrompt: "SYS",
      userBlock: "USER",
      allowedTools: [],
      continuation: {
        threadId: "thread-abc",
        parentId: "r1",
        previousEdits: [],
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    const args = spawnImpl.mock.calls[0][1] as string[];
    expect(args).toContain("--session");
    expect(args[args.indexOf("--session") + 1]).toBe("thread-abc");
  });
});
