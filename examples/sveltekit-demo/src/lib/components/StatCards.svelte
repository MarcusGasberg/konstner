<script lang="ts">
  import {
    TrendingUp,
    TrendingDown,
    Users,
    DollarSign,
    ShoppingBag,
    Activity,
  } from "lucide-svelte";
  import Card from "./ui/Card.svelte";
  import { cn } from "$lib/utils";
  import { fly } from "svelte/transition"

  const stats = [
    { label: "Total Revenue", value: "$84,320", change: "+12.5%", positive: true, icon: DollarSign, sub: "vs. last month" },
    { label: "Active Users", value: "14,208", change: "+8.1%", positive: true, icon: Users, sub: "vs. last month" },
    { label: "Total Orders", value: "3,847", change: "-2.4%", positive: false, icon: ShoppingBag, sub: "vs. last month" },
    { label: "Conversion Rate", value: "5.27%", change: "+0.9%", positive: true, icon: Activity, sub: "vs. last month" },
  ];
</script>

<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
  {#each stats as stat, i (stat.label)}
    <div in:fly={{ y: 16, duration: 400, delay: i * 80 }}>
    <Card class="p-5 flex flex-col gap-3 bg-slate-900 text-slate-100 border-slate-800">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-slate-400">{stat.label}</span>
        <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
          <stat.icon class="w-4 h-4 text-slate-100" />
        </div>
      </div>
      <div>
        <p class="text-2xl font-bold text-slate-50">{stat.value}</p>
        <div class="flex items-center gap-1 mt-1">
          {#if stat.positive}
            <TrendingUp class="w-3 h-3 text-green-400" />
          {:else}
            <TrendingDown class="w-3 h-3 text-red-400" />
          {/if}
          <span
            class={cn(
              "text-xs font-medium",
              stat.positive ? "text-green-400" : "text-red-400"
            )}
          >
            {stat.change}
          </span>
          <span class="text-xs text-slate-400">{stat.sub}</span>>
        </div>
      </div>
    </Card>
    </div>
  {/each}
</div>
