<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLDivElement> & { class?: string };
  let { class: className, children, ...rest }: Props = $props();
</script>

<div
  class={cn(
    "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
    className
  )}
  {...rest}
>
  {@render children?.()}
</div>
