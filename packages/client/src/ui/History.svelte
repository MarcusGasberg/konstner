<script lang="ts">
  import { useAppContext } from "../stores/context.js";
  import Thread from "./Thread.svelte";

  const { history } = useAppContext();
  const visibleThreads = $derived(history.threads.slice(0, 20));
</script>

{#if visibleThreads.length > 0}
  <div class="panel" role="region" aria-label="Request history">
    <div class="title">Requests</div>
    {#each visibleThreads as thread (thread.root.threadId)}
      <Thread {thread} />
    {/each}
  </div>
{/if}

<style>
  .panel {
    position: fixed; left: 16px; bottom: 16px; z-index: var(--k-z);
    width: 340px; max-height: calc(100vh - 120px); overflow-y: auto;
    background: var(--k-bg); color: var(--k-fg);
    border: 1px solid var(--k-border); border-radius: 12px;
    padding: 10px; font-size: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }
  .title {
    margin: 0 0 8px 0; font-size: 11px; color: var(--k-muted);
    letter-spacing: 0.1em; text-transform: uppercase;
  }
</style>
