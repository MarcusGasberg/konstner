import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CanonicalToolId,
  ProviderAdapter,
  ProviderDispatchInput,
  ProviderHandle,
  ProviderPrepareContext,
} from "@konstner/core";

function formatOpenCodeToolName(canonical: CanonicalToolId): string {
  if (canonical.startsWith("konstner.")) {
    const leaf = canonical.slice("konstner.".length);
    return `konstner_${leaf}`;
  }
  // OpenCode exposes builtin tools under lowercase names.
  if (canonical === "builtin.Bash.mkdir") return "bash";
  if (canonical.startsWith("builtin.")) {
    return canonical.slice("builtin.".length).toLowerCase();
  }
  return canonical;
}

const AGENT_PROMPT = "konstner-prompt";
const AGENT_EXTRACT = "konstner-extract";

/** Resolve the absolute path to the server's built MCP entrypoint. This file
 *  lives at packages/server/{src,dist}/providers/opencode.{ts,js}; the target
 *  is packages/server/dist/mcp.js in both cases. */
function defaultMcpCommand(): { command: string; args: string[] } {
  const here = dirname(fileURLToPath(import.meta.url));
  const mcpPath = resolvePath(here, "../../dist/mcp.js");
  return { command: "node", args: [mcpPath] };
}

function agentNameFor(kind: "prompt" | "extract"): string {
  return kind === "extract" ? AGENT_EXTRACT : AGENT_PROMPT;
}

interface OpenCodeConfig {
  $schema?: string;
  mcp?: Record<string, unknown>;
  [k: string]: unknown;
}

/** Merge a konstner MCP entry into an existing opencode.json, preserving
 *  all other keys. Returns the new JSON string with trailing newline. */
function mergeOpenCodeConfig(
  existing: OpenCodeConfig | null,
  konstnerMcp: Record<string, unknown>,
): string {
  const next: OpenCodeConfig = existing ? { ...existing } : {};
  if (!next.$schema) next.$schema = "https://opencode.ai/config.json";
  next.mcp = { ...(next.mcp ?? {}), konstner: konstnerMcp };
  return JSON.stringify(next, null, 2) + "\n";
}

function renderAgentMarkdown(opts: {
  description: string;
  systemPrompt: string;
  toolGlobs: string[];
}): string {
  const toolsYaml = opts.toolGlobs.map((g) => `  "${g}": true`).join("\n");
  return `---
description: ${opts.description}
tools:
${toolsYaml}
---

${opts.systemPrompt}
`;
}

/**
 * Wrap a user block as a single quoted arg for \`opencode run\`. Since we pass
 * via argv (not stdin), keep it as a positional string — the child's spawn
 * call handles shell-escaping when shell: false (the default).
 */

export interface OpenCodeProviderOptions {
  /** Override the CLI binary name (defaults to "opencode"). */
  binary?: string;
  /** Model override, e.g. "anthropic/claude-sonnet-4-5". */
  model?: string;
  /** Absolute path to the konstner MCP bridge command. Defaults to the
   *  server package's bin stub resolved from require.resolve-ish lookup.
   *  Providing an explicit path is recommended when the consumer ships a
   *  prebuilt Konstner. */
  mcpCommand?: { command: string; args?: string[] };
  /** Test hook. */
  spawnImpl?: typeof spawn;
  /** Test hook for config file IO. */
  writeFileImpl?: (path: string, content: string) => Promise<void>;
  /** Test hook for reading opencode.json. */
  readFileImpl?: (path: string) => Promise<string>;
}

export function createOpenCodeProvider(
  options: OpenCodeProviderOptions = {},
): ProviderAdapter {
  const binary = options.binary ?? "opencode";
  const spawnImpl = options.spawnImpl ?? spawn;
  const writeImpl =
    options.writeFileImpl ??
    (async (p: string, c: string) => {
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, c, "utf8");
    });
  const readImpl =
    options.readFileImpl ?? ((p: string) => readFile(p, "utf8"));

  const baseGlobs = ["konstner_*", "read", "glob", "grep"];
  const extractExtraGlobs = ["write", "edit", "bash"];

  return {
    id: "opencode",
    displayName: "OpenCode",
    formatToolName: formatOpenCodeToolName,

    async prepare(ctx: ProviderPrepareContext) {
      const mcpCommand = options.mcpCommand ?? defaultMcpCommand();
      const mcpEntry: Record<string, unknown> = {
        type: "local",
        enabled: true,
        command: [mcpCommand.command, ...(mcpCommand.args ?? [])],
        environment: { KONSTNER_PORT: String(ctx.port) },
      };

      const configPath = join(ctx.projectRoot, "opencode.json");
      let existing: OpenCodeConfig | null = null;
      try {
        existing = JSON.parse(await readImpl(configPath)) as OpenCodeConfig;
      } catch {
        existing = null;
      }
      const merged = mergeOpenCodeConfig(existing, mcpEntry);
      await writeImpl(configPath, merged);

      // Agent prompt bodies are written at dispatch time (they embed the
      // request-specific rendered system prompt). Here we only pre-create
      // placeholders so opencode recognizes the agent names on first run;
      // dispatch() overwrites with the real prompt before spawning.
      const placeholderPrompt = renderAgentMarkdown({
        description: "Konstner dispatcher (placeholder; rewritten per dispatch).",
        systemPrompt: "(pending)",
        toolGlobs: baseGlobs,
      });
      await writeImpl(
        join(ctx.projectRoot, ".opencode", "agents", `${AGENT_PROMPT}.md`),
        placeholderPrompt,
      );
      await writeImpl(
        join(ctx.projectRoot, ".opencode", "agents", `${AGENT_EXTRACT}.md`),
        renderAgentMarkdown({
          description:
            "Konstner component-extract dispatcher (placeholder; rewritten per dispatch).",
          systemPrompt: "(pending)",
          toolGlobs: [...baseGlobs, ...extractExtraGlobs],
        }),
      );
    },

    dispatch(input: ProviderDispatchInput): ProviderHandle {
      const kind = input.kind === "extract" ? "extract" : "prompt";
      const agent = agentNameFor(kind);
      const toolGlobs =
        kind === "extract" ? [...baseGlobs, ...extractExtraGlobs] : baseGlobs;

      // Rewrite the agent markdown with the current request's templated
      // system prompt. OpenCode has no CLI flag for system-prompt, so the
      // agent file is our injection seam.
      const agentPath = join(
        input.cwd,
        ".opencode",
        "agents",
        `${agent}.md`,
      );
      const agentBody = renderAgentMarkdown({
        description: `Konstner ${kind} dispatcher`,
        systemPrompt: input.systemPrompt,
        toolGlobs,
      });

      const args = ["run", "--agent", agent, "--format", "json"];
      if (options.model) args.push("--model", options.model);
      if (input.continuation) {
        args.push("--session", input.continuation.threadId);
      }
      args.push(input.userBlock);

      let child: ChildProcess | null = null;
      let cancelled = false;

      const done = (async () => {
        let existing: string | null = null;
        try {
          existing = await readImpl(agentPath);
        } catch {
          /* not present */
        }
        if (existing !== agentBody) await writeImpl(agentPath, agentBody);
        return await new Promise<{ code: number | null }>((resolve) => {
          if (cancelled) return resolve({ code: null });
          child = spawnImpl(binary, args, {
            cwd: input.cwd,
            env: {
              ...process.env,
              KONSTNER_PORT: String(input.port),
              KONSTNER_REQUEST_ID: input.requestId,
            },
            stdio: ["ignore", "pipe", "pipe"],
          });
          child.stdout?.on("data", (b: Buffer) => {
            const s = b.toString("utf8").trim();
            if (s) input.onLog?.(`[opencode] ${s}`);
          });
          child.stderr?.on("data", (b: Buffer) => {
            const s = b.toString("utf8").trim();
            if (s) input.onLog?.(`[opencode!] ${s}`);
          });
          child.on("error", (err) => {
            input.onLog?.(
              `[dispatch] failed to spawn ${binary}: ${err.message}. Is the \`${binary}\` CLI on PATH?`,
            );
          });
          child.on("exit", (code) => {
            input.onLog?.(`[dispatch] ${binary} exited with code ${code}`);
            resolve({ code });
          });
        });
      })();

      return {
        done,
        cancel() {
          cancelled = true;
          if (child && !child.killed) child.kill("SIGINT");
        },
      };
    },
  };
}

export { mergeOpenCodeConfig, renderAgentMarkdown, formatOpenCodeToolName };
