<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLLabelAttributes } from "svelte/elements";

  type Props = HTMLLabelAttributes & { class?: string };
  let { class: className, children, ...rest }: Props = $props();
</script>

<label
  class={cn("text-sm font-medium leading-none text-foreground", className)}
  {...rest}
>
  {@render children?.()}
</label>
