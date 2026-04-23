<script lang="ts">
  import type { AppContext } from "../stores/context.js";
  import { provideAppContext } from "../stores/context.js";
  import Fab from "./Fab.svelte";
  import Panel from "./Panel.svelte";
  import History from "./History.svelte";
  import ScanResults from "./ScanResults.svelte";
  import Outlines from "./Outlines.svelte";
  import Toasts from "./Toasts.svelte";

  interface Props {
    ctx: AppContext;
  }
  let { ctx }: Props = $props();

  // svelte-ignore state_referenced_locally
  provideAppContext(ctx);
</script>

<Fab />
<Panel />
<History />
<ScanResults />
<Outlines />
<Toasts />
