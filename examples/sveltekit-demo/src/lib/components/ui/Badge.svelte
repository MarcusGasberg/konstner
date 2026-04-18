<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLSpanElement> & {
    class?: string;
    variant?: "default" | "secondary";
  };
  let { class: className, variant = "default", children, ...rest }: Props = $props();

  const variants = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
  };
</script>

<span
  class={cn(
    "inline-flex items-center justify-center rounded-full text-xs font-medium px-2 py-0.5",
    variants[variant],
    className
  )}
  {...rest}
>
  {@render children?.()}
</span>
