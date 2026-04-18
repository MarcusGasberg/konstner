<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { mountOverlay, type OverlayHandle } from "./overlay.js";

  interface Props {
    port?: number;
  }

  let { port = 5177 }: Props = $props();

  let handle: OverlayHandle | null = null;

  onMount(() => {
    handle = mountOverlay({ port });
  });

  onDestroy(() => {
    handle?.destroy();
    handle = null;
  });
</script>
