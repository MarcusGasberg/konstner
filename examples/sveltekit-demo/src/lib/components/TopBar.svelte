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

  let notificationsOpen = $state(false);
  const notifications = [
    { id: 1, title: "New user signed up", time: "2m ago", unread: true },
    { id: 2, title: "Weekly report ready", time: "1h ago", unread: true },
    { id: 3, title: "System update available", time: "3h ago", unread: true },
    { id: 4, title: "5 new comments", time: "5h ago", unread: false },
    { id: 5, title: "Backup completed", time: "1d ago", unread: false },
  ];
  const unreadCount = $derived(notifications.filter((n) => n.unread).length);
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

    <div class="relative">
      <Button
        variant="ghost"
        size="icon"
        class="relative"
        onclick={() => (notificationsOpen = !notificationsOpen)}
        aria-label="Notifications"
      >
        <Bell class="w-4 h-4" />
        <Badge
          class="absolute -top-0.5 -right-0.5 w-4 h-4 p-0 text-[10px] flex items-center justify-center"
        >
          5
        </Badge>
      </Button>
      {#if notificationsOpen}
        <div
          class="absolute right-0 mt-2 w-80 rounded-md border border-border bg-card shadow-lg z-50"
        >
          <div
            class="px-4 py-2 border-b border-border text-sm font-semibold text-foreground flex items-center justify-between"
          >
            <span>Notifications</span>
            {#if unreadCount > 0}
              <span class="text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">{unreadCount} new</span>
            {/if}
          </div>
          <ul class="max-h-80 overflow-y-auto">
            {#each notifications as n (n.id)}
              <li
                class={[
                  "px-4 py-2 border-b border-border last:border-b-0 hover:bg-accent relative transition-colors",
                  n.unread && "bg-primary/5 border-l-2 border-l-primary",
                ]}
              >
                <div class="flex items-start gap-2">
                  {#if n.unread}
                    <span class="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-label="unread"></span>
                  {:else}
                    <span class="mt-1 w-1.5 h-1.5 shrink-0"></span>
                  {/if}
                  <div class="flex-1 min-w-0">
                    <p class={["text-xs", n.unread ? "font-semibold text-foreground" : "font-medium text-muted-foreground"]}>{n.title}</p>
                    <p class="text-[11px] text-muted-foreground mt-0.5">{n.time}</p>
                  </div>
                </div>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>

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
