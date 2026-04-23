<script lang="ts">
  import { SvelteMap } from "svelte/reactivity";
  import { useAppContext } from "../stores/context.js";
  const { toasts } = useAppContext();

  $effect(() => {
    const timers = new SvelteMap<string, ReturnType<typeof setTimeout>>();
    for (const t of toasts.items) {
      if (timers.has(t.id)) continue;
      const h = setTimeout(() => toasts.dismiss(t.id), 4000);
      timers.set(t.id, h);
    }
    return () => {
      for (const h of timers.values()) clearTimeout(h);
    };
  });
</script>

{#each toasts.items as t (t.id)}
  <div class="toast {t.level}" role="status">{t.message}</div>
{/each}

<style>
  .toast {
    position: fixed;
    right: 16px;
    bottom: 130px;
    z-index: var(--k-z);
    background: var(--k-surface);
    color: #fff;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #333;
    font-size: 12px;
    max-width: 360px;
  }
  .toast.success { border-color: var(--k-success); }
  .toast.error { border-color: var(--k-err); }
</style>
