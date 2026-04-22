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

## DESIGN.md

Konstner reads a `DESIGN.md` at the project root (spec: [google-labs-code/design.md](https://github.com/google-labs-code/design.md)) and uses it in four places:

- **MCP** — `get_design_system` returns parsed tokens + prose so the model can reference existing palette values before editing.
- **Linter** — the `design-md-token` rule flags hex colors in edits that don't match the DESIGN.md palette; suggestions include the closest token and the matching CSS variable.
- **Runtime** — `import "virtual:konstner/design-tokens.css"` injects `:root { --color-*: ... }` vars into the app.
- **Hot reload** — editing `DESIGN.md` re-parses tokens in-process and invalidates the virtual CSS module; no server restart needed.

See `examples/sveltekit-demo/DESIGN.md` for a working fixture.
