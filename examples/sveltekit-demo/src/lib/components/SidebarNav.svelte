<script lang="ts">
  import {
    LayoutDashboard,
    BarChart3,
    Users,
    ShoppingCart,
    FileText,
    Settings,
    Search,
    ChevronLeft,
    Zap,
    HelpCircle,
    LogOut,
  } from "lucide-svelte";
  import { cn } from "$lib/utils";
  import Button from "./ui/Button.svelte";
  import Badge from "./ui/Badge.svelte";

  type Props = {
    activeSection: string;
    onSectionChange: (id: string) => void;
  };
  let { activeSection, onSectionChange }: Props = $props();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", badge: null as string | null },
    { icon: BarChart3, label: "Analytics", id: "analytics", badge: null },
    { icon: Users, label: "Users", id: "users", badge: "24" },
    { icon: ShoppingCart, label: "Orders", id: "orders", badge: "3" },
    { icon: FileText, label: "Reports", id: "reports", badge: null },
    { icon: Settings, label: "Settings", id: "settings", badge: null },
  ];

  let collapsed = $state(false);
</script>

<aside
  class={cn(
    "flex flex-col h-screen bg-card border-r border-border transition-all duration-300 shrink-0",
    collapsed ? "w-16" : "w-60"
  )}
>
  <div class="flex items-center gap-2.5 px-4 h-16 border-b border-border shrink-0">
    <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
      <Zap class="w-4 h-4 text-primary-foreground" />
    </div>
    {#if !collapsed}
      <span class="font-semibold text-foreground text-base tracking-tight">Nucleus</span>
    {/if}
    <Button
      variant="ghost"
      size="icon"
      class={cn("ml-auto w-7 h-7 shrink-0", collapsed && "mx-auto")}
      onclick={() => (collapsed = !collapsed)}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      <ChevronLeft
        class={cn("w-4 h-4 transition-transform duration-300", collapsed && "rotate-180")}
      />
    </Button>
  </div>

  {#if !collapsed}
    <div class="px-3 py-3 border-b border-border">
      <div
        class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted text-muted-foreground text-sm cursor-pointer hover:bg-accent transition-colors"
      >
        <Search class="w-3.5 h-3.5 shrink-0" />
        <span>Search...</span>
        <kbd
          class="ml-auto text-xs bg-background border border-border rounded px-1 py-0.5 font-mono"
          >⌘K</kbd
        >
      </div>
    </div>
  {/if}

  <nav class="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
    {#if !collapsed}
      <p
        class="px-2 pb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider"
      >
        Main
      </p>
    {/if}
    {#each navItems as item (item.id)}
      <button
        type="button"
        onclick={() => onSectionChange(item.id)}
        class={cn(
          "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors",
          collapsed && "justify-center px-2",
          activeSection === item.id
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
        aria-label={item.label}
      >
        <item.icon class="w-4 h-4 shrink-0" />
        {#if !collapsed}
          <span>{item.label}</span>
        {/if}
        {#if !collapsed && item.badge}
          <Badge variant="secondary" class="ml-auto text-xs px-1.5 py-0">
            {item.badge}
          </Badge>
        {/if}
      </button>
    {/each}
  </nav>

  <div class="border-t border-border px-2 py-3 space-y-0.5 shrink-0">
    <button
      type="button"
      class={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
        collapsed && "justify-center"
      )}
      aria-label="Help"
    >
      <HelpCircle class="w-4 h-4 shrink-0" />
      {#if !collapsed}<span>Help</span>{/if}
    </button>
    <button
      type="button"
      class={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
        collapsed && "justify-center"
      )}
      aria-label="Log out"
    >
      <LogOut class="w-4 h-4 shrink-0" />
      {#if !collapsed}<span>Log out</span>{/if}
    </button>
  </div>
</aside>
