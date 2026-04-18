<script lang="ts">
  import { cn } from "$lib/utils";

  type Props = {
    class?: string;
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
  };
  let {
    class: className,
    checked = $bindable(false),
    onCheckedChange,
  }: Props = $props();

  function toggle() {
    checked = !checked;
    onCheckedChange?.(checked);
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label="Toggle"
  onclick={toggle}
  class={cn(
    "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    checked ? "bg-primary" : "bg-muted",
    className
  )}
>
  <span
    class={cn(
      "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
      checked ? "translate-x-4" : "translate-x-0"
    )}
  ></span>
</button>
