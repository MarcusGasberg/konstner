<script lang="ts">
  import type { ElementSelection } from "@konstner/core";
  import { useAppContext } from "../stores/context.js";

  interface Props {
    selection: ElementSelection;
  }
  let { selection }: Props = $props();

  const { history, panel } = useAppContext();

  function defaultName(tag: string): string {
    const base = tag.replace(/[^a-z0-9]+/gi, "") || "Block";
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  // svelte-ignore state_referenced_locally
  let name = $state<string>(defaultName(selection.tagName));
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    input?.focus();
    input?.select();
  });

  function submit() {
    const finalName = name.trim() || defaultName(selection.tagName);
    history.extract({ selection, name: finalName });
    panel.closeExtract();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") panel.closeExtract();
  }
</script>

<div class="form section">
  <h3>Extract to component</h3>
  <div class="prop-row">
    <label for="k-extract-name">name</label>
    <input
      id="k-extract-name"
      type="text"
      bind:this={input}
      bind:value={name}
      placeholder="ComponentName"
      onkeydown={onKey}
    />
  </div>
  <div class="actions">
    <button class="primary" onclick={submit}>Extract</button>
    <button class="ghost" onclick={() => panel.closeExtract()}>Cancel</button>
  </div>
</div>

<style>
  .section { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--k-border-soft); }
  h3 {
    margin: 0 0 8px 0; font-size: 11px; color: var(--k-muted);
    letter-spacing: 0.1em; text-transform: uppercase;
  }
  .prop-row {
    display: grid; grid-template-columns: 80px 1fr;
    gap: 8px; align-items: center; margin-bottom: 6px;
  }
  label { font-size: 11px; color: var(--k-muted); }
  input {
    background: var(--k-surface); color: var(--k-fg);
    border: 1px solid #333; border-radius: 4px;
    padding: 4px 6px; font-family: var(--k-mono);
    font-size: 12px; width: 100%;
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
</style>
