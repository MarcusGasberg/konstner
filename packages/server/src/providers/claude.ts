import { spawn, type ChildProcess } from "node:child_process";
import type {
  CanonicalToolId,
  ProviderAdapter,
  ProviderDispatchInput,
  ProviderHandle,
} from "@konstner/core";

function formatClaudeToolName(canonical: CanonicalToolId): string {
  if (canonical.startsWith("konstner.")) {
    const leaf = canonical.slice("konstner.".length);
    return `mcp__konstner__${leaf}`;
  }
  if (canonical === "builtin.Bash.mkdir") return "Bash(mkdir:*)";
  if (canonical.startsWith("builtin.")) return canonical.slice("builtin.".length);
  return canonical;
}

export interface ClaudeProviderOptions {
  /** Override the Claude CLI binary name (defaults to "claude"). */
  binary?: string;
  /** Test hook: override subprocess spawn. */
  spawnImpl?: typeof spawn;
}

export function createClaudeProvider(
  options: ClaudeProviderOptions = {},
): ProviderAdapter {
  const binary = options.binary ?? "claude";
  const spawnImpl = options.spawnImpl ?? spawn;

  return {
    id: "claude",
    displayName: "Claude Code",
    formatToolName: formatClaudeToolName,
    dispatch(input: ProviderDispatchInput): ProviderHandle {
      const allowedTools = input.allowedTools.map(formatClaudeToolName).join(",");
      const args = [
        "-p",
        input.userBlock,
        "--append-system-prompt",
        input.systemPrompt,
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        allowedTools,
        "--output-format",
        "stream-json",
        "--verbose",
      ];

      const child: ChildProcess = spawnImpl(binary, args, {
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
        if (s) input.onLog?.(`[claude] ${s}`);
      });
      child.stderr?.on("data", (b: Buffer) => {
        const s = b.toString("utf8").trim();
        if (s) input.onLog?.(`[claude!] ${s}`);
      });
      child.on("error", (err) => {
        input.onLog?.(
          `[dispatch] failed to spawn ${binary}: ${err.message}. Is the \`${binary}\` CLI on PATH?`,
        );
      });

      const done = new Promise<{ code: number | null }>((resolve) => {
        child.on("exit", (code) => {
          input.onLog?.(`[dispatch] ${binary} exited with code ${code}`);
          resolve({ code });
        });
      });

      return {
        done,
        cancel() {
          if (!child.killed) child.kill("SIGINT");
        },
      };
    },
  };
}
