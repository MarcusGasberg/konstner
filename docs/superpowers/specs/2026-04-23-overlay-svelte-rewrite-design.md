# Overlay Svelte Rewrite — Design

**Date:** 2026-04-23
**Status:** Draft
**Scope:** `packages/client/src/overlay.ts` and related client UI

## Goal

Replace the imperative 800-line `overlay.ts` with a Svelte 5 application mounted into the shadow root. Eliminate the manual `renderPanel()` / `renderHistory()` rebuild cycle, the string-literal style sheet, and the scattered state-mutation-then-rerender pattern.

Pain points being solved (confirmed with user):

- **A** — New UI affordances require touching state, rendering, styles, and event wiring in four places.
- **B** — State bugs (`openContinueIds`, `revertingThreadIds`, stale closures, forgotten `renderHistory()` calls).
- **C** — Styling lives in a 100-line string template with no scoping and no HMR.
- **E** — Nothing is unit-testable.

Navigation/cognition (D) is a side benefit, not a primary driver.

## Non-goals

- No product surface changes: the overlay still lives in-page, in a shadow root, behind a floating "K" button.
- No change to the ws protocol, MCP server, or `@konstner/core` types.
- No change to `picker.ts`'s public surface (its imperative event model is the right fit for hit-testing; it stays as-is).
- No refactor of `scan.ts`'s scan logic — it already returns pure data.
- No change to the `auto.ts` side-effect entry or the published `exports` map (except that both now bundle Svelte).
- No styling/design system overhaul — the rewrite preserves the current visual design. A design-token pass can come later.

## Constraints (from brainstorming)

- **Framework coupling:** the client lib may internally depend on Svelte 5; it's a dev tool and is not shipped to end-user production bundles. `svelte` moves from `peerDependencies` to `dependencies`.
- **Runtime isolation:** the overlay must still attach cleanly inside any host app (React, Vue, vanilla, Svelte). Mounting into a shadow root preserves this.
- **Migration shape:** big-bang on a single branch. `overlay.ts` is deleted at the end; no feature flag or dual-render period.
- **`KonstnerShell.svelte`:** kept and promoted — it becomes the real Svelte entry that mounts the reactive app, not a 21-line lifecycle shim.

## Architecture

### High level

```
┌─────────────────────────────────────────┐
│  Host page (user's app)                 │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │ shadow-host <div>                │    │
│  │  └─ shadow root                  │    │
│  │     ├─ <App />  (Svelte)         │    │
│  │     │   ├─ <Fab />               │    │
│  │     │   ├─ <Panel />             │    │
│  │     │   ├─ <History />           │    │
│  │     │   ├─ <ScanResults />       │    │
│  │     │   ├─ <Outlines />          │    │
│  │     │   └─ <Toasts />            │    │
│  │     └─ Picker (imperative,       │    │
│  │         writes to picker store)  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
          │ ws (unchanged)
          ▼
   Konstner dev server
```

The in-page `mountOverlay({ port })` function keeps its current public signature and `OverlayHandle` return. Internally it now:

1. Creates the shadow host + shadow root (same as today).
2. Constructs stores (see below).
3. Opens the websocket and wires `ws.onMessage` into the stores.
4. Instantiates `Picker` and wires its callbacks into the selection store.
5. Calls Svelte's `mount(App, { target: shadow, props: { stores, ws, picker } })`.
6. Returns `{ destroy() }` that tears down in reverse order.

### Component tree

All components live under `packages/client/src/ui/` with scoped `<style>` blocks. Component responsibilities:

- **`App.svelte`** — root; receives stores + transport, renders layout, passes stores down via context (`setContext`/`getContext`), not prop drilling.
- **`Fab.svelte`** — the floating "K" button; toggles panel open, reflects picker-active state.
- **`Panel.svelte`** — the right-hand panel; shows selected element summary, the prompt textarea, action buttons (Send, Extract, Scan, Pick, Clear). Receives `selectedElement` + `picker` from context.
- **`ExtractForm.svelte`** — the inline "extract to component" form. Rendered inside `Panel` via `{#if extractOpen}`.
- **`History.svelte`** — the left-hand request history; iterates threads via `{#each}`. Hosts `<Thread />` children.
- **`Thread.svelte`** — one thread (root + turns + actions + continue form).
- **`ContinueForm.svelte`** — per-thread follow-up textarea.
- **`ScanResults.svelte`** — scan output panel with findings + stats.
- **`Outlines.svelte`** — the hover + selected bounding-box overlays. Subscribes to the selection store and re-computes positions on scroll/resize via `$effect`.
- **`Toasts.svelte`** — toast container; consumes a toast store.

Rough sizes: each component is 30–120 lines. No component exceeds ~150 lines without being split.

### Stores

Svelte 5 runes-based stores live in `packages/client/src/stores/`. Each is a small `.svelte.ts` module exporting a factory that returns a `$state`-backed object.

- **`selection.svelte.ts`** — `{ current: ElementSelection | null, element: HTMLElement | null, setFromPicker(sel), clear(), stepUp() }`. `element` is derived from `current.kLocId` via `findByLoc()`. Publishes selection changes to ws.
- **`history.svelte.ts`** — `{ threads: ThreadView[], submit(prompt, selection, path), extract(selection, name), continue(parentId, prompt), handleResolved(msg), handleReverted(msg), requestRevert(threadId) }`. Internally owns the `HistoryEntry[]` and derives `threads` via `$derived`. Encapsulates the `openContinueIds`, `revertConfirmIds`, `revertingThreadIds` sets as per-thread flags on the view model — no more parallel Sets.
- **`panel.svelte.ts`** — `{ open, toggle(), extractOpen, openExtract(), closeExtract() }`.
- **`scan.svelte.ts`** — `{ result: ScanResult | null, visible: boolean, run(), close() }`.
- **`toasts.svelte.ts`** — `{ items: Toast[], push(level, message), dismiss(id) }`.

Stores are plain modules, testable without a DOM. Components get them via context (one `AppContext` bag) set in `App.svelte`.

### Outlines: reactive, not imperative

The existing `drawSelectedBox()` / `onHover` pattern moves into `Outlines.svelte`:

- Subscribes to the selection store for the "selected" box target element.
- Subscribes to a picker-hover store (written by `Picker.onHover`) for the "hover" box.
- Uses `$effect` + `getBoundingClientRect()` + a scroll/resize listener to compute positions.
- Renders two positioned `<div>`s with scoped styles.

`Picker` stays imperative (it's a state machine over window events) but gains a `hover` store it writes to; `onSelect` writes to the selection store.

### Styles

- Delete the 100-line `STYLES` string entirely.
- Each component owns a scoped `<style>` block with the relevant rules from the current stylesheet.
- A single top-level `<style>` (either in `App.svelte` or a shared `global.css` imported once) holds the shadow-root reset: `:host { all: initial }` and `* { box-sizing: border-box; font-family: ... }`.
- Shared color/size tokens (e.g. `#0b0b0f`, `#2563eb`, `#22c55e`, the z-index `2147483647`) move to a small `tokens.ts` exported as CSS custom properties set on `:host`.

### `KonstnerShell.svelte` and `auto.ts`

- `KonstnerShell.svelte` becomes the canonical mount surface for Svelte/SvelteKit users. Its `onMount` calls `mountOverlay({ port })` exactly as today — but now `mountOverlay` mounts the Svelte app internally. No change to the component's public `port` prop.
- `auto.ts` stays for non-Svelte hosts; same side-effect behavior.
- Both paths converge on the same `mountOverlay()` function. No duplicate UI implementations.

### Transport

`ws.ts` is unchanged. `mountOverlay` wires `ws.onMessage` to call the appropriate store methods:

- `toast` → `toasts.push`
- `request_resolved` → `history.handleResolved`
- `edit_applied` → `toasts.push("success", …)`
- `request_reverted` → `history.handleReverted`

Outbound messages (`selection_changed`, `request_change`, `request_continue`, `request_extract`, `request_revert`, `scan_page`) are sent from within store methods, which receive the `ws` instance at construction.

## Testing strategy

- **Store unit tests** (`*.test.ts` colocated with stores) — Vitest, no DOM. Cover: history thread grouping, revert state transitions, continue flow, toast dedupe.
- **Component tests** — `@testing-library/svelte` + Vitest + jsdom. Cover: history renders a loading thread correctly; clicking "Revert" enters confirm state then dispatches; "Send" clears textarea; Escape closes continue form.
- **Smoke integration** — one test that calls `mountOverlay({ port })` against a mock ws and asserts the shadow host + fab render.
- **No Playwright in this pass.** Outline positioning is the one thing that genuinely needs a browser; we verify manually in the sveltekit-demo example and add a Playwright test in a follow-up if it regresses.

New dev deps: `vitest`, `@testing-library/svelte`, `jsdom`. Added at the `@konstner/client` package level.

## Migration approach

Single branch, big-bang:

1. Add `svelte` to `dependencies` of `@konstner/client` (remove from `peerDependencies`). Add Vitest + testing-library devDeps.
2. Scaffold `src/ui/` and `src/stores/` with empty components + stores.
3. Build stores with tests (no UI yet).
4. Build components bottom-up: `Toasts` → `Outlines` → `Fab` → `ScanResults` → `ExtractForm` → `Panel` → `ContinueForm` → `Thread` → `History` → `App`.
5. Rewrite `mountOverlay()` in `overlay.ts` to mount `App` and wire stores to ws + picker.
6. Delete everything in the old `overlay.ts` below `mountOverlay()` (the `renderPanel`/`renderHistory`/`STYLES` etc.).
7. Smoke-test in `examples/sveltekit-demo`.
8. Final cleanup: rename `overlay.ts` → `mount.ts` if `mountOverlay` becomes trivially thin; otherwise leave named as-is.

The implementation plan (next step, produced by `writing-plans`) will decompose this into commit-sized tasks with verification gates.

## Risks and open questions

- **Svelte 5 `mount()` into a shadow root** — styles injected by Svelte land in `document.head` by default; we need to verify they either land in the shadow root or that scoped-class selectors still work from `document.head` (they do, because scoped class names are unique). If this causes visual issues in practice, fall back to compiling components with `customElement: false` and managing a single `<style>` element inside the shadow root manually.
- **Bundle size** — Svelte 5 runtime is ~10–15KB gzipped. Acceptable (dev tool, same machine as the server).
- **Consumers of `KonstnerShell.svelte`** — behavior is unchanged; props are unchanged.

## Out of scope (follow-ups)

- Design token pass / visual redesign.
- Playwright end-to-end tests for outline positioning.
- Extract the UI to an iframe (Direction 2 from the brainstorm) — deferred; the Svelte app built here is the payload for that if/when we take it.
- IDE panel / external window (Direction 3) — product decision, deferred.
