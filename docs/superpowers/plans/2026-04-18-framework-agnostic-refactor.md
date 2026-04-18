# Konstner Framework-Agnostic Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Konstner framework-agnostic and extensible: remove the hard Svelte dependency from the client overlay, introduce a real adapter interface so non-Svelte frameworks (React, Vue, plain HTML) can be added, add runtime protocol validation, split the client into focused modules, and stand up a test harness so future changes stay honest.

**Architecture:** Four shifts. **(1)** `packages/core` gains zod-backed protocol schemas (single source of truth, runtime-validated at the WS boundary) and a formal `FrameworkAdapter` interface describing annotation + rewrite + extract behavior. **(2)** `packages/vite-plugin` becomes adapter-agnostic: it accepts one or more `FrameworkAdapter` instances, picks the matching one per file extension, and the existing Svelte logic moves behind this interface. A `plain-html` adapter is added to prove the abstraction. **(3)** `packages/client` drops `KonstnerShell.svelte` entirely; `auto.ts` becomes the single entry point and consumers just import `@konstner/client/auto` as a side-effect module. `overlay.ts` (550 lines doing panel rendering, property editor, extract form, WS wiring, outlines, and toasts) is split into focused files: `overlay/shell.ts`, `overlay/panel.ts`, `overlay/property-editor.ts`, `overlay/extract-form.ts`, `overlay/outlines.ts`, `overlay/toast.ts`. **(4)** `packages/server` moves dispatch prompts and extraction conventions onto the adapter so the server is no longer Svelte-flavored. Web Components are explicitly **not** used — we keep one plain `mount()` function that owns a Shadow DOM root. No preact, no registry collisions.

**Tech Stack:** TypeScript 5.x, pnpm workspaces, Vite (peer), `magic-string`, `zod` (already a server dep, promoted to core), `ws`, `@modelcontextprotocol/sdk`, `vitest` + `happy-dom` (new, for tests).

**Out of scope (explicit):** Adding a React or Vue *annotation* adapter end-to-end, adding a preact/template layer, changing the MCP surface, multi-file edit support, WS state resync-on-reconnect. Those are follow-up plans.

---

## File Structure

Final layout after refactor (new files marked `+`, deleted `-`, modified `*`):

```
packages/core/src/
  index.ts                       *  re-export schemas + adapter types
  protocol.ts                    *  replaced with zod schemas; types inferred
+ adapter.ts                        FrameworkAdapter interface + AdapterContext
+ protocol.test.ts                  schema round-trip + reject tests

packages/vite-plugin/src/
  index.ts                       *  accepts adapters[]; dispatches per-file
  mcp-config.ts                     (unchanged)
  adapters/
    svelte.ts                    *  exports createSvelteAdapter(): FrameworkAdapter
+   plain-html.ts                   createPlainHtmlAdapter(): FrameworkAdapter
+   svelte.test.ts                  annotate round-trip
+   plain-html.test.ts              annotate round-trip

packages/client/src/
  index.ts                       *  exports mountOverlay + types only
  auto.ts                        *  thin side-effect entry (unchanged logic)
- entry.ts                          duplicate of index.ts, deleted
- KonstnerShell.svelte              deleted; sveltekit-demo switches to auto
  picker.ts                         (unchanged)
  ws.ts                          *  validates incoming messages via zod
  overlay.ts                     *  becomes a thin composer (~80 lines)
+ overlay/styles.ts                 the CSS string
+ overlay/shell.ts                  FAB + shadow host + wiring
+ overlay/panel.ts                  selected-element panel
+ overlay/property-editor.ts        sections, rows, debounce, rgbToHex
+ overlay/extract-form.ts           extract-to-component form
+ overlay/outlines.ts               hover + selected outline boxes
+ overlay/toast.ts                  toast renderer
+ overlay.test.ts                   happy-dom smoke test for mountOverlay

packages/server/src/
  sidecar.ts                     *  validates WS frames via zod; adapter-aware
  dispatch.ts                    *  prompts come from adapter, not hardcoded
  adapters/
    svelte-rewrite.ts            *  renamed export: createSvelteServerAdapter
+   plain-html-rewrite.ts           minimal server adapter for plain html
+   svelte-rewrite.test.ts          property-edit round-trip
  state.ts, mcp.ts, rpc.ts, edits.ts  (unchanged)

examples/sveltekit-demo/
  src/routes/+layout.svelte      *  remove <KonstnerShell />; rely on auto-inject
  vite.config.ts                 *  pass adapters: [svelte()] to plugin

docs/
  adapters.md                    +  "how to write a FrameworkAdapter"

root/
  vitest.config.ts               +  shared vitest config
  package.json                   *  add vitest, happy-dom; add `test` script
```

**Decomposition rationale:** `overlay.ts` is the primary offender — it mixes six concerns in one file. Splitting by responsibility (not by layer) keeps each file under ~120 lines and lets tests target one thing at a time. The adapter interface lives in `core` (not `vite-plugin`) because both the plugin *and* the server need it.

---

## Interfaces (locked before tasks)

These types are referenced by multiple tasks — fix them here so nothing drifts.

```ts
// packages/core/src/adapter.ts

export interface AnnotateResult {
  code: string;
  map: import("magic-string").SourceMap;
}

export interface AnnotateContext {
  /** Project-root-relative file path, forward slashes. */
  filename: string;
}

export interface PropertyEditInput {
  /** Absolute file path. */
  file: string;
  /** The `data-k-loc` line/col of the opening tag. */
  line: number;
  col: number;
  property: string;
  value: string;
  /** Current file contents. */
  source: string;
}

export interface FrameworkAdapter {
  /** Human-readable id, e.g. "svelte", "plain-html". */
  id: string;
  /** Returns true if this adapter owns the file. */
  matches(id: string): boolean;
  /** Inject `data-k-loc` attributes. Return null if no changes. */
  annotate(code: string, ctx: AnnotateContext): AnnotateResult | null;
  /** Apply a property edit by rewriting source. Null = adapter declines. */
  applyPropertyEdit(input: PropertyEditInput): { newSource: string } | null;
  /** Prompts injected into the Claude CLI dispatch for this adapter. */
  prompts: {
    /** System prompt for "change this element" requests. */
    change: string;
    /** System prompt for "extract to component" requests. */
    extract: string;
  };
  /** Suggested file extension for newly extracted components. */
  componentExtension: string;
}
```

All `protocol.ts` types become zod schemas:

```ts
// packages/core/src/protocol.ts (skeleton — full content in Task 1)
import { z } from "zod";

export const SourceLoc = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
});
export type SourceLoc = z.infer<typeof SourceLoc>;

export const ElementSelection = z.object({
  kLocId: z.string(),
  loc: SourceLoc.nullable(),
  tagName: z.string(),
  outerHTML: z.string(),
  computedStyles: z.record(z.string(), z.string()),
  ancestors: z.array(z.object({ tagName: z.string(), loc: SourceLoc.nullable() })),
});
export type ElementSelection = z.infer<typeof ElementSelection>;
// ... (see Task 1 for full file)
```

---

## Task 1: Add zod-backed protocol schemas to `packages/core`

**Files:**
- Modify: `packages/core/package.json` (add `zod` dep)
- Replace: `packages/core/src/protocol.ts`
- Create: `packages/core/src/protocol.test.ts`
- Modify: `packages/core/src/index.ts`
- Create: `vitest.config.ts` (root)
- Modify: `package.json` (root, add vitest + happy-dom + `test` script)

- [ ] **Step 1: Add root vitest config and test script**

Create `/home/marcusg/source/repos/konstner/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/*/src/**/*.test.ts"],
    environmentMatchGlobs: [
      ["packages/client/src/**", "happy-dom"],
    ],
  },
});
```

Modify root `package.json` — add to `devDependencies`: `"vitest": "^2.1.0"`, `"happy-dom": "^15.0.0"`, `"zod": "^3.23.0"`. Add script: `"test": "vitest run"`.

Run: `pnpm install`
Expected: install succeeds.

- [ ] **Step 2: Add zod dep to core**

Edit `packages/core/package.json` — add `"dependencies": { "zod": "^3.23.0" }` (keep it as a real dep, not peer; core is small and cheap to bundle).

Run: `pnpm install`

- [ ] **Step 3: Write the failing schema round-trip test**

Create `packages/core/src/protocol.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ClientToServer,
  ServerToClient,
  ElementSelection,
  parseClientMessage,
  parseServerMessage,
} from "./protocol.js";

const sampleSel: ElementSelection = {
  kLocId: "src/App.svelte:12:4",
  loc: { file: "src/App.svelte", line: 12, col: 4 },
  tagName: "div",
  outerHTML: "<div></div>",
  computedStyles: { color: "rgb(0, 0, 0)" },
  ancestors: [],
};

describe("protocol schemas", () => {
  it("accepts a valid request_change", () => {
    const msg: ClientToServer = {
      type: "request_change",
      id: "req_1",
      selection: sampleSel,
      prompt: "make it red",
    };
    expect(parseClientMessage(msg)).toEqual(msg);
  });

  it("rejects an unknown message type", () => {
    expect(() => parseClientMessage({ type: "bogus" })).toThrow();
  });

  it("rejects a request_change with empty prompt as any string still passes — we accept empty", () => {
    // Empty prompts are filtered in the UI; the schema allows them.
    expect(() =>
      parseClientMessage({ type: "request_change", id: "x", selection: sampleSel, prompt: "" }),
    ).not.toThrow();
  });

  it("accepts a server toast", () => {
    const msg: ServerToClient = { type: "toast", level: "error", message: "boom" };
    expect(parseServerMessage(msg)).toEqual(msg);
  });

  it("rejects a toast with bad level", () => {
    expect(() =>
      parseServerMessage({ type: "toast", level: "warning", message: "x" }),
    ).toThrow();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test -- packages/core`
Expected: FAIL — `parseClientMessage` not exported.

- [ ] **Step 5: Replace `packages/core/src/protocol.ts`**

```ts
import { z } from "zod";

export const SourceLoc = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
});
export type SourceLoc = z.infer<typeof SourceLoc>;

export const ElementSelection = z.object({
  kLocId: z.string(),
  loc: SourceLoc.nullable(),
  tagName: z.string(),
  outerHTML: z.string(),
  computedStyles: z.record(z.string(), z.string()),
  ancestors: z.array(z.object({ tagName: z.string(), loc: SourceLoc.nullable() })),
});
export type ElementSelection = z.infer<typeof ElementSelection>;

export const PendingRequestKind = z.enum(["prompt", "extract"]);
export type PendingRequestKind = z.infer<typeof PendingRequestKind>;

export const PendingRequest = z.object({
  id: z.string(),
  kind: PendingRequestKind,
  createdAt: z.number(),
  selection: z.union([ElementSelection, z.array(ElementSelection)]),
  prompt: z.string().optional(),
  suggestedName: z.string().optional(),
});
export type PendingRequest = z.infer<typeof PendingRequest>;

export const TextEdit = z.object({
  file: z.string(),
  startLine: z.number().int().nonnegative(),
  startCol: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  endCol: z.number().int().nonnegative(),
  newText: z.string(),
});
export type TextEdit = z.infer<typeof TextEdit>;

export const ClientToServer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), clientId: z.string() }),
  z.object({ type: z.literal("selection_changed"), selection: ElementSelection.nullable() }),
  z.object({
    type: z.literal("request_change"),
    id: z.string(),
    selection: ElementSelection,
    prompt: z.string(),
  }),
  z.object({
    type: z.literal("request_extract"),
    id: z.string(),
    selection: z.array(ElementSelection),
    suggestedName: z.string(),
  }),
  z.object({
    type: z.literal("apply_property_edit"),
    selection: ElementSelection,
    property: z.string(),
    value: z.string(),
  }),
]);
export type ClientToServer = z.infer<typeof ClientToServer>;

export const ServerToClient = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello_ack"), serverVersion: z.string() }),
  z.object({ type: z.literal("pending_requests"), requests: z.array(PendingRequest) }),
  z.object({ type: z.literal("request_resolved"), id: z.string(), summary: z.string() }),
  z.object({ type: z.literal("edit_applied"), edits: z.array(TextEdit) }),
  z.object({
    type: z.literal("toast"),
    level: z.enum(["info", "success", "error"]),
    message: z.string(),
  }),
]);
export type ServerToClient = z.infer<typeof ServerToClient>;

export function parseClientMessage(raw: unknown): ClientToServer {
  return ClientToServer.parse(raw);
}
export function parseServerMessage(raw: unknown): ServerToClient {
  return ServerToClient.parse(raw);
}

export const WS_PATH = "/__konstner__";
export const DEFAULT_PORT = 5177;
```

- [ ] **Step 6: Update `packages/core/src/index.ts` to re-export everything**

```ts
export * from "./protocol.js";
export * from "./adapter.js";
```

(`adapter.js` is created in Task 2 — ts will error until then. Delete the `./adapter.js` line if Task 2 is not bundled with this commit; otherwise do Task 2 first.)

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm test -- packages/core && pnpm typecheck`
Expected: tests pass, typecheck may fail until Task 2 lands if `./adapter.js` is referenced.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml \
  packages/core/package.json packages/core/src/protocol.ts \
  packages/core/src/protocol.test.ts packages/core/src/index.ts
git commit -m "core: zod-backed protocol schemas with parse helpers"
```

---

## Task 2: Define `FrameworkAdapter` interface in `packages/core`

**Files:**
- Create: `packages/core/src/adapter.ts`

- [ ] **Step 1: Write the file**

Paste the full `FrameworkAdapter` / `AnnotateResult` / `AnnotateContext` / `PropertyEditInput` definitions from the **Interfaces (locked before tasks)** section above into `packages/core/src/adapter.ts`.

- [ ] **Step 2: Ensure `src/index.ts` re-exports it**

Already done in Task 1 Step 6. Verify: `grep -n adapter packages/core/src/index.ts`.

- [ ] **Step 3: Build + typecheck**

Run: `pnpm -r --filter @konstner/core build && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/adapter.ts
git commit -m "core: define FrameworkAdapter interface"
```

---

## Task 3: Extract Svelte annotation behind `FrameworkAdapter` (vite-plugin)

**Files:**
- Modify: `packages/vite-plugin/src/adapters/svelte.ts`
- Create: `packages/vite-plugin/src/adapters/svelte.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/vite-plugin/src/adapters/svelte.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createSvelteAdapter } from "./svelte.js";

describe("svelte adapter", () => {
  const adapter = createSvelteAdapter();

  it("matches .svelte files only", () => {
    expect(adapter.matches("/abs/App.svelte")).toBe(true);
    expect(adapter.matches("/abs/App.tsx")).toBe(false);
  });

  it("injects data-k-loc into plain elements", () => {
    const src = `<div>\n  <span>hi</span>\n</div>\n`;
    const out = adapter.annotate(src, { filename: "App.svelte" });
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`data-k-loc="App.svelte:1:0"`);
    expect(out!.code).toContain(`data-k-loc="App.svelte:2:2"`);
  });

  it("skips component tags and svelte: tags", () => {
    const src = `<Foo /><svelte:head></svelte:head>`;
    const out = adapter.annotate(src, { filename: "x.svelte" });
    expect(out).toBeNull();
  });

  it("skips tags inside <script> and <style>", () => {
    const src = `<script>const x = "<div>";</script><style>.a{color:red}</style><p>hi</p>`;
    const out = adapter.annotate(src, { filename: "x.svelte" });
    expect(out!.code.match(/data-k-loc/g)!.length).toBe(1);
  });

  it("has svelte-flavored prompts and .svelte extension", () => {
    expect(adapter.componentExtension).toBe(".svelte");
    expect(adapter.prompts.extract.toLowerCase()).toContain("svelte");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- packages/vite-plugin`
Expected: FAIL — `createSvelteAdapter` not exported.

- [ ] **Step 3: Rewrite `packages/vite-plugin/src/adapters/svelte.ts`**

Keep the existing `annotateSvelteSource` regex + helpers as *internal* functions. Add a factory that returns a `FrameworkAdapter`. Keep `annotateSvelteSource` exported for backward compat during migration; remove it in Task 6.

```ts
import MagicString from "magic-string";
import type { FrameworkAdapter, AnnotateResult, AnnotateContext } from "@konstner/core";
// Lazy import to avoid circular dep at build time:
// server adapter lives in @konstner/server; vite-plugin will import it in createSvelteAdapter.
import { applySveltePropertyEdit } from "@konstner/server/adapters/svelte-rewrite";

const TAG_RE = /<([a-z][a-z0-9-]*)(?=[\s/>])([^>]*?)(\/?)>/g;
const BLOCK_RE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

const CHANGE_PROMPT = `You are editing a Svelte 5 component. Preserve <script>/<style> blocks; modify only the requested element's attributes, classes, or children. Use runes when adding state.`;
const EXTRACT_PROMPT = `Extract the given subtree into a new Svelte 5 component under src/lib/components/. Use <script lang="ts"> with $props(). Replace the original subtree with an import + usage.`;

export function createSvelteAdapter(): FrameworkAdapter {
  return {
    id: "svelte",
    matches: (id) => id.endsWith(".svelte"),
    annotate,
    applyPropertyEdit: (input) => {
      const newSource = applySveltePropertyEdit(input);
      return newSource ? { newSource } : null;
    },
    prompts: { change: CHANGE_PROMPT, extract: EXTRACT_PROMPT },
    componentExtension: ".svelte",
  };
}

function annotate(code: string, ctx: AnnotateContext): AnnotateResult | null {
  const ms = new MagicString(code);
  let touched = false;
  const offsets = buildLineOffsets(code);
  const blocked = findBlockedRanges(code);
  for (const match of code.matchAll(TAG_RE)) {
    const start = match.index ?? 0;
    if (isInRanges(start, blocked)) continue;
    const tagName = match[1];
    const attrs = match[2] ?? "";
    if (attrs.includes("data-k-loc=")) continue;
    if (/^[A-Z]/.test(tagName) || tagName.includes(":")) continue;
    const { line, col } = toLineCol(offsets, start);
    const insertAt = start + 1 + tagName.length;
    ms.appendLeft(insertAt, ` data-k-loc="${ctx.filename}:${line}:${col}"`);
    touched = true;
  }
  if (!touched) return null;
  return { code: ms.toString(), map: ms.generateMap({ hires: true, source: ctx.filename }) };
}

// ... keep buildLineOffsets/toLineCol/findBlockedRanges/isInRanges as before
```

The server-side `applySveltePropertyEdit` needs to accept the new `PropertyEditInput` shape. Update it in Task 5; for now, if its existing signature differs, write a thin shim inside `createSvelteAdapter.applyPropertyEdit` and mark with a `// TASK-5` comment — but the shim must be deleted by Task 5. **Do not leave shims uncommented**.

- [ ] **Step 4: Run test**

Run: `pnpm test -- packages/vite-plugin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/vite-plugin/src/adapters/svelte.ts packages/vite-plugin/src/adapters/svelte.test.ts
git commit -m "vite-plugin: wrap svelte annotation in FrameworkAdapter"
```

---

## Task 4: Add a `plain-html` adapter (proves the abstraction)

**Files:**
- Create: `packages/vite-plugin/src/adapters/plain-html.ts`
- Create: `packages/vite-plugin/src/adapters/plain-html.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { createPlainHtmlAdapter } from "./plain-html.js";

describe("plain-html adapter", () => {
  const adapter = createPlainHtmlAdapter();

  it("matches .html only", () => {
    expect(adapter.matches("index.html")).toBe(true);
    expect(adapter.matches("foo.svelte")).toBe(false);
  });

  it("annotates body elements, skips <!doctype>, <html>, <head>, <script>, <style>", () => {
    const src = `<!doctype html><html><head><title>x</title></head><body><main><p>hi</p></main></body></html>`;
    const out = adapter.annotate(src, { filename: "index.html" });
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`<main data-k-loc=`);
    expect(out!.code).toContain(`<p data-k-loc=`);
    expect(out!.code).not.toContain(`<title data-k-loc=`);
    expect(out!.code).not.toContain(`<html data-k-loc=`);
  });
});
```

- [ ] **Step 2: Run — verify FAIL**

Run: `pnpm test -- plain-html`
Expected: FAIL.

- [ ] **Step 3: Implement `plain-html.ts`**

Reuse the same `TAG_RE` / block-range helpers by extracting them into `packages/vite-plugin/src/adapters/shared.ts` (create it; move `buildLineOffsets`, `toLineCol`, `findBlockedRanges`, `isInRanges`, `TAG_RE`, `BLOCK_RE` there; update `svelte.ts` to import them). Then:

```ts
import MagicString from "magic-string";
import type { FrameworkAdapter, AnnotateResult, AnnotateContext } from "@konstner/core";
import { TAG_RE, BLOCK_RE, buildLineOffsets, findBlockedRanges, isInRanges, toLineCol } from "./shared.js";

const SKIP = new Set(["html", "head", "body", "title", "meta", "link", "base"]);
const CHANGE_PROMPT = `You are editing a plain HTML file. Preserve doctype and head. Modify only the requested element.`;
const EXTRACT_PROMPT = `Extract the subtree into a new .html partial in ./partials/. Replace the original with an HTML comment linking to the partial path.`;

export function createPlainHtmlAdapter(): FrameworkAdapter {
  return {
    id: "plain-html",
    matches: (id) => id.endsWith(".html"),
    annotate,
    applyPropertyEdit: () => null, // not supported yet; use the prompt path
    prompts: { change: CHANGE_PROMPT, extract: EXTRACT_PROMPT },
    componentExtension: ".html",
  };
}

function annotate(code: string, ctx: AnnotateContext): AnnotateResult | null {
  const ms = new MagicString(code);
  let touched = false;
  const offsets = buildLineOffsets(code);
  const blocked = findBlockedRanges(code);
  for (const match of code.matchAll(TAG_RE)) {
    const start = match.index ?? 0;
    if (isInRanges(start, blocked)) continue;
    const tagName = match[1];
    if (SKIP.has(tagName)) continue;
    const attrs = match[2] ?? "";
    if (attrs.includes("data-k-loc=")) continue;
    const { line, col } = toLineCol(offsets, start);
    ms.appendLeft(start + 1 + tagName.length, ` data-k-loc="${ctx.filename}:${line}:${col}"`);
    touched = true;
  }
  if (!touched) return null;
  return { code: ms.toString(), map: ms.generateMap({ hires: true, source: ctx.filename }) };
}
```

- [ ] **Step 4: Run — verify PASS**

Run: `pnpm test -- plain-html`
Expected: PASS. Also rerun svelte tests to confirm the `shared.ts` move didn't break them: `pnpm test -- packages/vite-plugin`.

- [ ] **Step 5: Commit**

```bash
git add packages/vite-plugin/src/adapters/plain-html.ts \
  packages/vite-plugin/src/adapters/plain-html.test.ts \
  packages/vite-plugin/src/adapters/shared.ts \
  packages/vite-plugin/src/adapters/svelte.ts
git commit -m "vite-plugin: add plain-html adapter; share annotation helpers"
```

---

## Task 5: Refactor server adapter to `FrameworkAdapter`-compatible shape

**Files:**
- Modify: `packages/server/src/adapters/svelte-rewrite.ts`
- Create: `packages/server/src/adapters/svelte-rewrite.test.ts`

- [ ] **Step 1: Write a failing round-trip test**

```ts
import { describe, it, expect } from "vitest";
import { applySveltePropertyEdit } from "./svelte-rewrite.js";

describe("applySveltePropertyEdit", () => {
  it("sets an inline style on a plain div", () => {
    const src = `<div data-k-loc="App.svelte:1:0">hi</div>\n`;
    const out = applySveltePropertyEdit({
      file: "App.svelte",
      line: 1,
      col: 0,
      property: "color",
      value: "red",
      source: src,
    });
    expect(out).not.toBeNull();
    expect(out!).toContain(`style="color: red;"`);
  });

  it("updates an existing style attribute in place", () => {
    const src = `<div data-k-loc="App.svelte:1:0" style="color: blue;">hi</div>`;
    const out = applySveltePropertyEdit({
      file: "App.svelte", line: 1, col: 0, property: "color", value: "red", source: src,
    });
    expect(out!).toContain(`color: red`);
    expect(out!).not.toContain(`color: blue`);
  });
});
```

- [ ] **Step 2: Run — verify FAIL or drift**

Run: `pnpm test -- svelte-rewrite`
Expected: fails if the current signature is `(source, selection, property, value)` rather than the `PropertyEditInput` object.

- [ ] **Step 3: Refactor signature to accept `PropertyEditInput`**

Rewrite `applySveltePropertyEdit` to take `{ file, line, col, property, value, source }` and return `string | null` (the new source, or null if no edit possible). Update `sidecar.ts` call sites. Delete any shim left in Task 3.

- [ ] **Step 4: Run — verify PASS**

Run: `pnpm test` (full run — make sure nothing downstream broke).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/adapters/svelte-rewrite.ts \
  packages/server/src/adapters/svelte-rewrite.test.ts \
  packages/server/src/sidecar.ts
git commit -m "server: svelte rewrite accepts PropertyEditInput"
```

---

## Task 6: Make vite-plugin accept `adapters[]` and dispatch per-file

**Files:**
- Modify: `packages/vite-plugin/src/index.ts`

- [ ] **Step 1: New plugin signature**

```ts
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
      const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../client");
      return { server: { fs: { allow: [clientRoot] } } };
    },
    configResolved(c) { config = c; },
    async configureServer(server) {
      sidecar = await startSidecar({ projectRoot: config.root, port, adapters });
      await writeMcpConfig(config.root, port);
      server.httpServer?.once("close", () => sidecar?.close());
      server.config.logger.info(
        `\n  \u25B2  konstner on http://127.0.0.1:${port}  (adapters: ${adapters.map(a => a.id).join(", ")})\n`,
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
```

- [ ] **Step 2: Update `startSidecar` signature to accept `adapters`**

In `packages/server/src/sidecar.ts`, add `adapters: FrameworkAdapter[]` to the options. Pick the right adapter per incoming WS `apply_property_edit` by matching against `selection.loc.file`. Pass the chosen adapter's prompts to `dispatch.ts` (Task 7).

- [ ] **Step 3: Typecheck + test**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/vite-plugin/src/index.ts packages/server/src/sidecar.ts
git commit -m "vite-plugin: accept adapters[]; dispatch per-file"
```

---

## Task 7: Move dispatch prompts onto the adapter

**Files:**
- Modify: `packages/server/src/dispatch.ts`
- Modify: `packages/server/src/sidecar.ts` (pass adapter through)

- [ ] **Step 1: Change dispatch signature**

Dispatch currently has `PROMPT_SYSTEM` and `EXTRACT_SYSTEM` as module-level constants. Replace with a required argument on the dispatch functions:

```ts
export function dispatchChange(opts: {
  adapter: FrameworkAdapter;
  request: PendingRequest;
  projectRoot: string;
}) { /* use opts.adapter.prompts.change */ }

export function dispatchExtract(opts: {
  adapter: FrameworkAdapter;
  request: PendingRequest;
  projectRoot: string;
}) { /* use opts.adapter.prompts.extract and opts.adapter.componentExtension */ }
```

Remove all Svelte-specific string literals from `dispatch.ts`.

- [ ] **Step 2: Route the right adapter in sidecar**

When processing a pending request, resolve the adapter by matching `request.selection` (or the first of the array) `.loc.file` against the loaded `adapters[]`. If none match, emit a `toast` with `level: "error"` and the message `"no adapter matched <file>"`.

- [ ] **Step 3: Run full test suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/dispatch.ts packages/server/src/sidecar.ts
git commit -m "server: dispatch prompts move onto adapter"
```

---

## Task 8: Validate WS frames on both ends via zod

**Files:**
- Modify: `packages/server/src/sidecar.ts`
- Modify: `packages/client/src/ws.ts`

- [ ] **Step 1: Server-side validation**

In `sidecar.ts`, wrap the incoming WS `message` handler:

```ts
import { parseClientMessage } from "@konstner/core";
// ...
ws.on("message", (raw) => {
  let msg;
  try { msg = parseClientMessage(JSON.parse(String(raw))); }
  catch (e) { console.warn("[konstner] dropped invalid client frame:", e); return; }
  handleMessage(msg);
});
```

- [ ] **Step 2: Client-side validation**

In `packages/client/src/ws.ts`, `onMessage` should `parseServerMessage` before invoking callbacks. On parse error, log to `console.warn` and drop.

- [ ] **Step 3: Test — invalid frames are dropped**

Add `packages/server/src/sidecar.test.ts` (minimal — spin up sidecar on an ephemeral port, send a garbage frame, assert no throw and no state change). If this proves too heavy, instead unit-test `parseClientMessage` rejection in `protocol.test.ts` (already done) and add a TODO in the sidecar file explaining manual verification.

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/sidecar.ts packages/client/src/ws.ts
git commit -m "ws: validate frames via zod on both ends"
```

---

## Task 9: Split `overlay.ts` into focused files

**Files:**
- Create: `packages/client/src/overlay/styles.ts`
- Create: `packages/client/src/overlay/outlines.ts`
- Create: `packages/client/src/overlay/toast.ts`
- Create: `packages/client/src/overlay/property-editor.ts`
- Create: `packages/client/src/overlay/extract-form.ts`
- Create: `packages/client/src/overlay/panel.ts`
- Create: `packages/client/src/overlay/shell.ts`
- Replace: `packages/client/src/overlay.ts` (re-export only)

- [ ] **Step 1: Move the CSS constant**

`styles.ts`:

```ts
export const OVERLAY_STYLES = `
:host { all: initial; }
/* ... paste all CSS from the current overlay.ts STYLES constant ... */
`;
```

- [ ] **Step 2: Move outlines (hover + selected boxes)**

`outlines.ts` exports a factory:

```ts
export function createOutlines(shadow: ShadowRoot) {
  const hover = document.createElement("div");
  hover.className = "outline"; hover.style.display = "none"; shadow.appendChild(hover);
  const selected = document.createElement("div");
  selected.className = "outline selected"; selected.style.display = "none"; shadow.appendChild(selected);
  function drawAt(box: HTMLElement, el: HTMLElement | null) {
    if (!el) { box.style.display = "none"; return; }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: "block", top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
  }
  return {
    showHover: (el: HTMLElement | null) => drawAt(hover, el),
    showSelected: (el: HTMLElement | null) => drawAt(selected, el),
    hideHover: () => { hover.style.display = "none"; },
    hideSelected: () => { selected.style.display = "none"; },
  };
}
```

- [ ] **Step 3: Move toast**

`toast.ts`:

```ts
export function createToaster(shadow: ShadowRoot) {
  return function toast(level: "info" | "success" | "error", message: string) {
    const el = document.createElement("div");
    el.className = `toast ${level}`;
    el.textContent = message;
    shadow.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  };
}
```

- [ ] **Step 4: Move property editor**

`property-editor.ts` contains `SECTIONS`, `buildPropertySection`, `buildPropRow`, `debounce`, `rgbToHex`, and exports `buildPropertySection`. Copy them verbatim from the current `overlay.ts`.

- [ ] **Step 5: Move extract form**

`extract-form.ts` exports `openExtractForm(panelEl, sel, onSubmit)`. Copy from current `overlay.ts:240-289`. Replace the hardcoded title/button strings that say "Svelte component" with "component" — the adapter decides extension.

- [ ] **Step 6: Move panel**

`panel.ts` exports `renderPanel({ panel, sel, selectedEl, onSubmitPrompt, onExtract, onStepUp, onClose, onPropertyEdit })` — takes the current selection and returns void, mutating the panel DOM. Copy from current `overlay.ts:168-238`. Remove the hardcoded "Svelte" string in the extract button title.

- [ ] **Step 7: Create `shell.ts`**

This is the orchestrator — creates the host element + shadow root, wires picker + ws + outlines + panel + toast. Roughly:

```ts
import type { ElementSelection, ServerToClient } from "@konstner/core";
import { Picker, describe } from "../picker.js";
import { connectWs } from "../ws.js";
import { OVERLAY_STYLES } from "./styles.js";
import { createOutlines } from "./outlines.js";
import { createToaster } from "./toast.js";
import { renderPanel } from "./panel.js";

export interface OverlayHandle { destroy(): void; }

export function mountOverlay(opts: { port: number }): OverlayHandle {
  const host = document.createElement("div");
  host.id = "konstner-overlay-host";
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = OVERLAY_STYLES;
  shadow.appendChild(style);

  const fab = makeFab(shadow);
  const outlines = createOutlines(shadow);
  const panel = makePanel(shadow);
  const toast = createToaster(shadow);
  const ws = connectWs(opts.port);

  let currentSelection: ElementSelection | null = null;
  let selectedEl: HTMLElement | null = null;
  // ... (picker wiring, stepUp, submit, sendPropertyEdit, sendExtract,
  //      renderPanel call, ws.onMessage, scroll/resize/keydown listeners) ...

  document.body.appendChild(host);
  return { destroy() { ws.close(); picker.stop(); host.remove(); } };
}
```

The picker wiring, `findByLoc`, `findNextAnnotatedAncestor`, `stepUp`, `submit`, `sendExtract`, `sendPropertyEdit`, scroll/resize/keydown listeners, and ws.onMessage handler all live here. Helper functions `findByLoc`, `findNextAnnotatedAncestor`, `defaultComponentName` go into a new `overlay/dom-helpers.ts`.

- [ ] **Step 8: Slim `overlay.ts`**

```ts
export { mountOverlay, type OverlayHandle } from "./overlay/shell.js";
```

- [ ] **Step 9: Write a smoke test**

Create `packages/client/src/overlay.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { mountOverlay } from "./overlay.js";

describe("mountOverlay", () => {
  it("appends a shadow host and removes it on destroy", () => {
    // Stub WebSocket so connectWs doesn't throw in happy-dom.
    (globalThis as any).WebSocket = class { send() {} close() {} addEventListener() {} };
    const handle = mountOverlay({ port: 0 });
    const host = document.getElementById("konstner-overlay-host");
    expect(host).not.toBeNull();
    expect(host!.shadowRoot).not.toBeNull();
    handle.destroy();
    expect(document.getElementById("konstner-overlay-host")).toBeNull();
  });
});
```

- [ ] **Step 10: Run tests**

Run: `pnpm test -- packages/client`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add packages/client/src/overlay.ts packages/client/src/overlay/ packages/client/src/overlay.test.ts
git commit -m "client: split overlay.ts into focused modules"
```

---

## Task 10: Delete `KonstnerShell.svelte` and `entry.ts`; consumer uses `auto`

**Files:**
- Delete: `packages/client/src/KonstnerShell.svelte`
- Delete: `packages/client/src/entry.ts`
- Modify: `packages/client/src/index.ts`
- Modify: `packages/client/package.json` (drop `svelte` peer, update `exports`)
- Modify: `examples/sveltekit-demo/src/routes/+layout.svelte`
- Modify: `examples/sveltekit-demo/vite.config.ts`

- [ ] **Step 1: Remove the Svelte files**

```bash
rm packages/client/src/KonstnerShell.svelte packages/client/src/entry.ts
```

- [ ] **Step 2: Update `index.ts` and `package.json` exports**

`packages/client/src/index.ts`:

```ts
export { mountOverlay, type OverlayHandle } from "./overlay.js";
```

In `packages/client/package.json`:
- Remove `"svelte"` from `peerDependencies` (if present).
- Set `"exports"` to expose `"."` (→ `./dist/index.js`) and `"./auto"` (→ `./dist/auto.js`). Remove any Svelte export entry.

- [ ] **Step 3: Have the vite-plugin inject `/@konstner/client/auto` via `transformIndexHtml`**

In `packages/vite-plugin/src/index.ts`, add a `transformIndexHtml` hook that injects `<script type="module" src="/@id/@konstner/client/auto"></script>` and a small `<script>window.__KONSTNER__={port:${port}};</script>` before it. This makes the demo zero-config — no manual `<KonstnerShell />`.

- [ ] **Step 4: Update the SvelteKit demo**

Edit `+layout.svelte` — remove the `import KonstnerShell` line and the `<KonstnerShell />` usage. Leave the rest alone. The plugin injects the overlay now.

- [ ] **Step 5: Run the demo manually (smoke test)**

Run: `pnpm --filter sveltekit-demo dev`
Expected: demo boots; open `http://localhost:5173` in a browser; the FAB button (`K`) appears bottom-right; click it, pick an element, see the panel. This manual check is required — `mountOverlay` has a unit test but the injection path does not.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "client: drop KonstnerShell.svelte; vite-plugin auto-injects overlay"
```

---

## Task 11: Server adds a `plain-html-rewrite` stub (keep the surface symmetric)

**Files:**
- Create: `packages/server/src/adapters/plain-html-rewrite.ts`

- [ ] **Step 1: Minimal stub**

```ts
import type { PropertyEditInput } from "@konstner/core";
export function applyPlainHtmlPropertyEdit(_input: PropertyEditInput): string | null {
  // Not implemented: plain-html property edits go through the prompt path.
  return null;
}
```

Wire it into `createPlainHtmlAdapter.applyPropertyEdit` if that's cleaner than the inline `() => null`. Either is fine — pick one and be consistent.

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/adapters/plain-html-rewrite.ts packages/vite-plugin/src/adapters/plain-html.ts
git commit -m "server: plain-html rewrite stub for symmetry"
```

---

## Task 12: Write `docs/adapters.md`

**Files:**
- Create: `docs/adapters.md`

- [ ] **Step 1: Write the doc**

Cover: the `FrameworkAdapter` interface (copy the type definition), how `matches` is called per file in vite, how prompts flow into Claude CLI dispatch, how `applyPropertyEdit` is optional, and a worked example of adding a "react-jsx" adapter (just the `matches` + `annotate` shape — don't implement it). Under 200 lines.

- [ ] **Step 2: Commit**

```bash
git add docs/adapters.md
git commit -m "docs: how to write a FrameworkAdapter"
```

---

## Task 13: Final sweep — typecheck, tests, demo manual check

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: PASS across all packages.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 3: Full build**

Run: `pnpm build`
Expected: all packages build.

- [ ] **Step 4: Demo manual check (again)**

Run: `pnpm --filter sveltekit-demo dev`, open in browser, exercise: pick an element, edit `color` in property editor, confirm source file is modified on disk. Confirm the FAB is auto-injected with no `<KonstnerShell />` in `+layout.svelte`.

- [ ] **Step 5: Update README**

Edit `README.md`:
- Layout section: remove mention of "Svelte 5" from `packages/client` line; add `- packages/client — in-page Shadow DOM overlay (framework-agnostic vanilla TS)`.
- Add a short "Adapters" section pointing to `docs/adapters.md`.
- Remove the "add `<KonstnerShell />` to your root layout" instruction from the dev section — it's auto-injected now.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "readme: framework-agnostic client; adapter docs"
```

---

## Self-Review Notes

**Spec coverage:**
- Remove Svelte from client → Tasks 9, 10.
- Framework-agnostic / adapter pattern → Tasks 2, 3, 4, 6, 7.
- Schema validation on protocol → Tasks 1, 8.
- Improve extensibility & sustainability → Tasks 1 (tests), 9 (file split), 12 (docs).
- "Hot mess" cleanup → Tasks 5 (signature), 9 (split), 10 (kill duplicate entry.ts), 3/5 (kill adapter-specific strings in dispatch/panel).

**Explicitly deferred (call out to user before execution):** React/Vue annotation adapters, WS resync-on-reconnect, multi-file edits. If any are in-scope for you, stop before Task 1 and we'll write separate plans.

**Risk notes:**
- Task 10 Step 3 (`transformIndexHtml` auto-injection) has not been verified against SvelteKit's own transforms. If SvelteKit strips or reorders the injected tag, fall back to requiring the user to import `@konstner/client/auto` once in their root layout's `<script>` — document in the demo.
- Task 3 depends on server adapter signature; Task 5 finalizes it. If executed out of order, Task 3 will need a shim that Task 5 removes — shim MUST be deleted.
