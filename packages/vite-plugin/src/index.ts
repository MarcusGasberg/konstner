import type { Plugin, ResolvedConfig } from "vite";
import type { FrameworkAdapter, ProviderAdapter } from "@konstner/core";
import { DEFAULT_PORT } from "@konstner/core";
import { startSidecar, type Sidecar } from "@konstner/server/sidecar";
import { createClaudeProvider } from "@konstner/server/providers/claude";
import { createSvelteAdapter } from "./adapters/svelte.js";
import { writeMcpConfig } from "./mcp-config.js";
import { relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface DesignCheckConfig {
  enabled: boolean;
  autoFixMaxLoops: number;
  strict: boolean;
}

export interface KonstnerOptions {
  port?: number;
  /** If omitted, defaults to [createSvelteAdapter()] for backward compat. */
  adapters?: FrameworkAdapter[];
  /** Design anti-pattern detection and auto-fix configuration. */
  designCheck?: DesignCheckConfig;
  /** AI provider that executes dispatched requests. Defaults to Claude. */
  provider?: ProviderAdapter;
}

export default function konstner(opts: KonstnerOptions = {}): Plugin {
  const port = opts.port ?? DEFAULT_PORT;
  const adapters = opts.adapters ?? [createSvelteAdapter()];
  const provider = opts.provider ?? createClaudeProvider();
  let config: ResolvedConfig;
  let sidecar: Sidecar | null = null;

  return {
    name: "konstner",
    apply: "serve",
    enforce: "pre",
    config() {
      const clientRoot = resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../client",
      );
      return {
        server: {
          fs: { allow: [clientRoot] },
          watch: { ignored: ["**/.opencode/**", "**/opencode.json"] },
        },
      };
    },
    configResolved(c) {
      config = c;
    },
    async configureServer(server) {
      sidecar = await startSidecar({
        projectRoot: config.root,
        port,
        adapters,
        designCheck: opts.designCheck,
        provider,
      });
      await writeMcpConfig(config.root, port);
      server.httpServer?.once("close", () => sidecar?.close());
      server.config.logger.info(
        `\n  \u25B2  konstner on http://127.0.0.1:${port}  (adapters: ${adapters.map((a) => a.id).join(", ")}, provider: ${provider.id})\n`,
      );
    },
    transform(code, id) {
      const adapter = adapters.find((a) => a.matches(id));
      if (!adapter) return null;
      const rel = relative(config.root, id);
      const out = adapter.annotate(code, { filename: rel });
      return out ? { code: out.code, map: out.map } : null;
    },
  };
}

export { createSvelteAdapter } from "./adapters/svelte.js";
export { createPlainHtmlAdapter } from "./adapters/plain-html.js";
export { createClaudeProvider } from "@konstner/server/providers/claude";
export { createOpenCodeProvider } from "@konstner/server/providers/opencode";
export type { ProviderAdapter } from "@konstner/core";
