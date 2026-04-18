<script lang="ts" module>
  export type Variant = "default" | "outline" | "ghost" | "destructive" | "secondary";
  export type Size = "default" | "sm" | "icon";
</script>

<script lang="ts">
  import { cn } from "$lib/utils";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Props = HTMLButtonAttributes & {
    class?: string;
    variant?: Variant;
    size?: Size;
  };
  let {
    class: className,
    variant = "default",
    size = "default",
    children,
    type = "button",
    ...rest
  }: Props = $props();

  const variants: Record<Variant, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    outline:
      "border border-border bg-transparent hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  };
  const sizes: Record<Size, string> = {
    default: "h-9 px-4 text-sm",
    sm: "h-8 px-3 text-xs",
    icon: "h-8 w-8",
  };
</script>

<button
  {type}
  class={cn(
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    className
  )}
  {...rest}
>
  {@render children?.()}
</button>
