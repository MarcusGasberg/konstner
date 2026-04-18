<script lang="ts">
  import Card from "./ui/Card.svelte";
  import {
    UserPlus,
    ShoppingCart,
    AlertCircle,
    CheckCircle,
    Star,
    RefreshCw,
  } from "lucide-svelte";

  const activities = [
    { icon: UserPlus, color: "text-blue-500 bg-blue-500/10", message: "New user signed up", sub: "lena.hartman@email.com", time: "2m ago" },
    { icon: ShoppingCart, color: "text-green-500 bg-green-500/10", message: "Order #ORD-003 completed", sub: "$999 — Enterprise Plan", time: "14m ago" },
    { icon: AlertCircle, color: "text-red-500 bg-red-500/10", message: "Payment failed for #ORD-004", sub: "Card ending in 4242 declined", time: "31m ago" },
    { icon: Star, color: "text-yellow-500 bg-yellow-500/10", message: "New 5-star review received", sub: "\"Incredible product!\"", time: "1h ago" },
    { icon: CheckCircle, color: "text-green-500 bg-green-500/10", message: "Deployment successful", sub: "v2.4.1 pushed to production", time: "2h ago" },
    { icon: RefreshCw, color: "text-purple-500 bg-purple-500/10", message: "Subscription renewed", sub: "Priya Nair — Enterprise", time: "3h ago" },
  ];
</script>

<Card class="p-5 flex flex-col gap-4">
  <div>
    <h2 class="text-sm font-semibold text-foreground">Activity Feed</h2>
    <p class="text-xs text-muted-foreground mt-0.5">Live system events</p>
  </div>
  <ul class="space-y-4">
    {#each activities as item, i (i)}
      <li class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 {item.color}">
          <item.icon class="w-3.5 h-3.5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-foreground leading-tight">{item.message}</p>
          <p class="text-xs text-muted-foreground mt-0.5 truncate">{item.sub}</p>
        </div>
        <span class="text-xs text-muted-foreground shrink-0">{item.time}</span>
      </li>
    {/each}
  </ul>
</Card>
