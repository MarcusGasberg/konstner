<script lang="ts">
  import type { ThreadView } from "../stores/history.svelte.js";
  import { useAppContext } from "../stores/context.js";
  import ContinueForm from "./ContinueForm.svelte";

  interface Props {
    thread: ThreadView;
  }
  let { thread }: Props = $props();

  const { history } = useAppContext();

  const rowStatus = $derived(
    thread.reverted ? "reverted" : thread.busy ? "loading" : "done",
  );
  const latest = $derived(thread.turns[thread.turns.length - 1]);

  function toggleContinue() {
    if (thread.continueOpen) history.closeContinue(thread.root.threadId);
    else history.openContinue(thread.root.threadId);
  }

  function onRevertClick() {
    if (thread.confirming) history.requestRevert(thread.root.threadId);
    else history.confirmRevert(thread.root.threadId);
  }
</script>

<div class="row {rowStatus}">
  <div class="dot"></div>
  <div class="body">
    <div class="target">{thread.root.target}</div>
    <div class="turns">
      {#each thread.turns as turn, idx (turn.id)}
        <div
          class="turn"
          class:follow={idx > 0}
          class:loading={turn.status === "loading"}
        >
          {#if idx > 0}
            <div class="turn-label">Follow-up {idx}</div>
          {/if}
          <div class="prompt">{turn.prompt}</div>
          {#if turn.summary}
            <div class="summary">{turn.summary}</div>
          {/if}
        </div>
      {/each}
    </div>

    {#if !thread.reverted}
      <div class="actions">
        <button onclick={toggleContinue} disabled={thread.busy}>
          {thread.continueOpen ? "Cancel" : "Continue"}
        </button>
        <button
          class:confirm={thread.confirming}
          onclick={onRevertClick}
          disabled={thread.busy || thread.reverting}
        >
          {thread.reverting
            ? "Reverting…"
            : thread.confirming
              ? "Confirm revert?"
              : "Revert"}
        </button>
      </div>

      {#if thread.continueOpen}
        <ContinueForm parentId={latest.id} threadId={thread.root.threadId} />
      {/if}
    {/if}
  </div>
</div>

<style>
  .row {
    display: grid; grid-template-columns: 10px 1fr;
    gap: 8px; padding: 8px 0;
    border-top: 1px solid var(--k-border-soft);
  }
  .row:first-of-type { border-top: none; }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    margin-top: 5px; background: #4b5563;
  }
  .row.loading .dot {
    background: var(--k-warn);
    animation: k-pulse 1s ease-in-out infinite;
  }
  .row.done .dot { background: var(--k-success); }
  .row.reverted .dot { background: #6b7280; }
  .target {
    color: var(--k-blue-text); font-family: var(--k-mono);
    font-size: 11px; word-break: break-all;
  }
  .turns { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
  .turn {
    position: relative; padding-left: 12px;
    border-left: 2px solid var(--k-hist-border);
  }
  .turn.follow { border-left-color: var(--k-accent); }
  .turn.loading { border-left-color: var(--k-warn); }
  .turn-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em;
    color: #6b7280; margin-bottom: 2px;
  }
  .turn.follow .turn-label { color: #60a5fa; }
  .prompt { color: var(--k-fg); margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
  .summary {
    color: var(--k-muted); margin-top: 4px; font-size: 11px;
    white-space: pre-wrap; word-break: break-word;
  }
  .actions { display: flex; gap: 6px; margin-top: 6px; }
  .actions button {
    background: transparent; color: #aaa;
    border: 1px solid #2a2a36; padding: 2px 8px;
    border-radius: 4px; cursor: pointer;
    font-size: 11px; font-family: inherit;
  }
  .actions button:hover:not(:disabled) { color: var(--k-fg); border-color: #3a3a46; }
  .actions button:disabled { opacity: 0.35; cursor: not-allowed; }
  .actions button.confirm { color: #fca5a5; border-color: #7f1d1d; }
</style>
