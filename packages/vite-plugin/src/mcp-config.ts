import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export async function writeMcpConfig(projectRoot: string, port: number): Promise<void> {
  const file = resolve(projectRoot, ".mcp.json");
  const binPath = resolveServerEntry();
  const entry = {
    command: "node",
    args: [binPath],
    env: { KONSTNER_PORT: String(port) },
  };

  let existing: Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      existing = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }
  const servers = (existing.mcpServers as Record<string, unknown>) ?? {};
  servers.konstner = entry;
  existing.mcpServers = servers;
  await writeFile(file, JSON.stringify(existing, null, 2) + "\n", "utf8");
}

function resolveServerEntry(): string {
  // from packages/vite-plugin/dist/ → packages/server/dist/mcp.js
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../server/dist/mcp.js");
}
