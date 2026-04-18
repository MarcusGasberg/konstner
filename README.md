# Konstner

HTML/CSS design shell wired to Claude Code. Click elements in your running app, prompt changes, and Claude edits the source through an MCP connection.

Status: Phase A (MVP-core). See the implementation plan for scope.

## Layout

- `packages/core` — shared protocol types
- `packages/server` — local WS bridge + MCP server
- `packages/vite-plugin` — Vite plugin (Svelte adapter first)
- `packages/client` — in-page Shadow DOM overlay (Svelte 5)
- `examples/sveltekit-demo` — dogfood target

## Dev

```
pnpm install
pnpm --filter sveltekit-demo dev
```

Then start a Claude Code session from the demo directory; the plugin writes a `.mcp.json` that exposes the `konstner` MCP server.
