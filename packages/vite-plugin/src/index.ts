import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin, ResolvedConfig } from "vite";
import { DEFAULT_PORT } from "@konstner/core";
import { startSidecar, type Sidecar } from "@konstner/server/sidecar";
import { createSvelteAdapter } from "./adapters/svelte.js";
import { writeMcpConfig } from "./mcp-config.js";

export interface KonstnerOptions {
  port?: number;
  adapter?: "svelte";
}

export default function konstner(opts: KonstnerOptions = {}): Plugin {
  let config: ResolvedConfig;
  let sidecar: Sidecar | null = null;
  const port = opts.port ?? DEFAULT_PORT;
  const adapterOpt = opts.adapter ?? "svelte";
  const svelteAdapter = createSvelteAdapter();

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
        },
      };
    },

    configResolved(c) {
      config = c;
    },

    async configureServer(server) {
      sidecar = await startSidecar({ projectRoot: config.root, port });
      await writeMcpConfig(config.root, port);
      server.httpServer?.once("close", () => {
        sidecar?.close();
      });
      server.config.logger.info(
        `\n  \u25B2  konstner  shell on http://127.0.0.1:${port}\n  \u25B2  add <KonstnerShell /> to your root layout to show the overlay\n`,
      );
    },

    transform(code, id) {
      if (adapterOpt !== "svelte") return null;
      if (!id.endsWith(".svelte")) return null;
      const rel = relative(config.root, id);
      const out = svelteAdapter.annotate(code, { filename: rel });
      if (!out) return null;
      return { code: out.code, map: out.map };
    },
  };
}

