<script lang="ts">
  import { Bell, Moon, Sun, User } from "lucide-svelte";
  import Button from "./ui/Button.svelte";
  import Badge from "./ui/Badge.svelte";

  type Props = { title: string };
  let { title }: Props = $props();

  let darkMode = $state(false);

  function toggleDark() {
    darkMode = !darkMode;
    document.documentElement.classList.toggle("dark");
  }
</script>

<header
  class="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0"
>
  <div>
    <h1 class="text-base font-semibold text-foreground">{title}</h1>
    <p class="text-xs text-muted-foreground">April 17, 2026</p>
  </div>

  <div class="flex items-center gap-2">
    <Button variant="ghost" size="icon" onclick={toggleDark} aria-label="Toggle dark mode">
      {#if darkMode}
        <Sun class="w-4 h-4" />
      {:else}
        <Moon class="w-4 h-4" />
      {/if}
    </Button>

    <Button variant="ghost" size="icon" class="relative" aria-label="Notifications">
      <Bell class="w-4 h-4" />
      <Badge
        class="absolute -top-0.5 -right-0.5 w-4 h-4 p-0 text-[10px] flex items-center justify-center"
      >
        5
      </Badge>
    </Button>

    <div class="flex items-center gap-2.5 pl-2 ml-1 border-l border-border">
      <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
        <User class="w-4 h-4 text-primary-foreground" />
      </div>
      <div class="hidden sm:block">
        <p class="text-xs font-medium text-foreground leading-none">Alex Mercer</p>
        <p class="text-[11px] text-muted-foreground mt-0.5">Admin</p>
      </div>
    </div>
  </div>
</header>
