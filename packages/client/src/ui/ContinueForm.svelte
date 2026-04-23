<script lang="ts">
  import { useAppContext } from "../stores/context.js";

  interface Props {
    parentId: string;
    threadId: string;
  }
  let { parentId, threadId }: Props = $props();

  const { history } = useAppContext();

  let value = $state("");
  let ta: HTMLTextAreaElement | undefined = $state();

  $effect(() => {
    ta?.focus();
  });

  function submit() {
    const v = value.trim();
    if (!v) return;
    history.continueThread(parentId, v);
    value = "";
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
    if (e.key === "Escape") history.closeContinue(threadId);
  }
</script>

<div class="form">
  <textarea
    bind:this={ta}
    bind:value
    onkeydown={onKey}
    placeholder="Refine or follow up... (⌘↵ to send)"
  ></textarea>
  <button class="confirm" onclick={submit}>Send follow-up</button>
</div>

<style>
  .form { margin-top: 6px; display: flex; flex-direction: column; gap: 6px; }
  textarea {
    min-height: 48px; font-size: 12px; padding: 6px;
    background: var(--k-surface); color: var(--k-fg);
    border: 1px solid #333; border-radius: 6px;
    font-family: inherit; resize: vertical;
  }
  .confirm {
    background: transparent; color: #fca5a5;
    border: 1px solid #7f1d1d; padding: 2px 8px;
    border-radius: 4px; cursor: pointer; font-size: 11px; font-family: inherit;
  }
</style>
