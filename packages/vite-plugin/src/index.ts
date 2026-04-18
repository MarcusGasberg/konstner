import type { Plugin, ResolvedConfig } from "vite";
import type { FrameworkAdapter } from "@konstner/core";
import { DEFAULT_PORT } from "@konstner/core";
import { startSidecar, type Sidecar } from "@konstner/server/sidecar";
import { createSvelteAdapter } from "./adapters/svelte.js";
import { writeMcpConfig } from "./mcp-config.js";
import { relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface KonstnerOptions {
  port?: number;
  /** If omitted, defaults to [createSvelteAdapter()] for backward compat. */
  adapters?: FrameworkAdapter[];
}

export default function konstner(opts: KonstnerOptions = {}): Plugin {
  const port = opts.port ?? DEFAULT_PORT;
  const adapters = opts.adapters ?? [createSvelteAdapter()];
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
      return { server: { fs: { allow: [clientRoot] } } };
    },
    configResolved(c) {
      config = c;
    },
    async configureServer(server) {
      sidecar = await startSidecar({
        projectRoot: config.root,
        port,
        adapters,
      });
      await writeMcpConfig(config.root, port);
      server.httpServer?.once("close", () => sidecar?.close());
      server.config.logger.info(
        `\n  \u25B2  konstner on http://127.0.0.1:${port}  (adapters: ${adapters.map((a) => a.id).join(", ")})\n`,
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
