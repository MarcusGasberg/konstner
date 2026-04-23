<script lang="ts">
  import { describe } from "../picker.js";
  import { useAppContext } from "../stores/context.js";
  import { findNextAnnotatedAncestor } from "../stores/selection.svelte.js";
  import ExtractForm from "./ExtractForm.svelte";

  const { panel, picker, selection, hover, history, scan } = useAppContext();

  let textarea: HTMLTextAreaElement | undefined = $state();
  let prompt = $state("");

  const sel = $derived(selection.current);
  const picking = $derived(hover.active);
  const locLine = $derived.by(() => {
    if (!sel) {
      return picking
        ? "Click an element on the page, or describe a page-level change below."
        : "No element selected — requests will target this page.";
    }
    return sel.loc
      ? `${sel.loc.file}:${sel.loc.line}:${sel.loc.col}`
      : "(no source location — did the plugin transform this file?)";
  });

  const hasAnnotatedAncestor = $derived(
    findNextAnnotatedAncestor(selection.element) !== null,
  );

  $effect(() => {
    if (panel.open) queueMicrotask(() => textarea?.focus());
  });

  function togglePicker() {
    if (picker.isActive()) picker.stop();
    else picker.start();
  }

  function stepUp() {
    const next = findNextAnnotatedAncestor(selection.element);
    if (!next) return;
    const newSel = describe(next);
    selection.setFromPicker(newSel);
  }

  function clear() {
    selection.clear();
  }

  function submit() {
    if (!prompt.trim()) return;
    history.submit({
      prompt,
      selection: sel,
      path: location.pathname,
    });
    prompt = "";
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
  }

  // Arrow-up on non-input to step up to annotated ancestor.
  $effect(() => {
    if (!panel.open) return;
    function onGlobalKey(e: KeyboardEvent) {
      if (!selection.current) return;
      if (e.key !== "ArrowUp" || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      e.preventDefault();
      stepUp();
    }
    window.addEventListener("keydown", onGlobalKey, true);
    return () => window.removeEventListener("keydown", onGlobalKey, true);
  });
</script>

{#if panel.open}
  <div class="panel" role="dialog" aria-label="Konstner panel">
    <h3>{sel ? "Selected" : "Page"}</h3>

    <div class="row">
      {#if sel}
        <span class="badge">&lt;{sel.tagName}&gt;</span>
        <button
          class="ghost step-up"
          title="Select parent (↑)"
          disabled={!hasAnnotatedAncestor}
          onclick={stepUp}
        >↑</button>
      {:else}
        <span class="badge">{location.pathname}</span>
      {/if}
      <button class="ghost" onclick={togglePicker}>
        {picking ? "Cancel" : sel ? "Pick another" : "Pick element"}
      </button>
      {#if sel}
        <button
          class="ghost"
          title="Clear selection (send a page-level request)"
          onclick={clear}
        >Clear</button>
      {/if}
    </div>

    <div class="loc">{locLine}</div>

    <textarea
      bind:this={textarea}
      bind:value={prompt}
      onkeydown={onKey}
      placeholder={sel
        ? "Describe the change... (⌘↵ to send)"
        : "Describe a change to this page... (⌘↵ to send)"}
    ></textarea>

    <div class="actions">
      <button class="primary" onclick={submit}>Send</button>
      {#if sel}
        <button
          class="ghost"
          title="Extract this subtree into a new Svelte component"
          onclick={() => (panel.extractOpen ? panel.closeExtract() : panel.openExtract())}
        >Extract…</button>
      {/if}
      <button class="ghost scan-btn" title="Scan page for design issues" onclick={() => scan.run()}>
        Scan
      </button>
    </div>

    {#if sel && panel.extractOpen}
      <ExtractForm selection={sel} />
    {/if}
  </div>
{/if}

<style>
  .panel {
    position: fixed; right: 16px; bottom: 72px; z-index: var(--k-z);
    width: 360px; max-height: calc(100vh - 120px); overflow-y: auto;
    background: var(--k-bg); color: var(--k-fg);
    border: 1px solid var(--k-border); border-radius: 12px;
    padding: 12px; font-size: 13px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }
  h3 {
    margin: 0 0 8px 0; font-size: 12px; color: var(--k-muted);
    letter-spacing: 0.1em; text-transform: uppercase;
  }
  .row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
  .badge {
    background: var(--k-hist-border); padding: 2px 6px;
    border-radius: 4px; font-family: var(--k-mono); font-size: 11px;
  }
  .loc {
    color: var(--k-blue-text); font-family: var(--k-mono);
    font-size: 11px; word-break: break-all;
  }
  textarea {
    width: 100%; min-height: 72px;
    background: var(--k-surface); color: var(--k-fg);
    border: 1px solid #333; border-radius: 6px;
    padding: 8px; font-family: inherit; font-size: 13px; resize: vertical;
  }
  .actions { display: flex; gap: 8px; margin-top: 8px; }
  .primary {
    background: var(--k-accent); color: var(--k-accent-fg);
    border: none; padding: 6px 12px; border-radius: 6px;
    cursor: pointer; font-weight: 600;
  }
  .ghost {
    background: transparent; color: #aaa; border: 1px solid #333;
    padding: 6px 10px; border-radius: 6px; cursor: pointer;
  }
  .step-up { padding: 2px 8px; font-size: 12px; line-height: 1; }
  .step-up:disabled { opacity: 0.35; cursor: not-allowed; }
  .scan-btn { color: var(--k-muted); padding: 4px 8px; font-size: 11px; }
  .scan-btn:hover { color: var(--k-fg); border-color: #555; }
</style>
