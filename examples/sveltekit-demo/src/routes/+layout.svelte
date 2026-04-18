<script lang="ts">
  import "../app.css";
  import KonstnerShell from "@konstner/client/KonstnerShell.svelte";

  let { children } = $props();
</script>

{@render children()}

{#if import.meta.env.DEV}
  <KonstnerShell />
{/if}
