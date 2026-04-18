<script lang="ts">
  import Card from "./ui/Card.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import {
    Search,
    ArrowUpDown,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    Download,
  } from "lucide-svelte";
  import { cn } from "$lib/utils";

  const allOrders = [
    { id: "#ORD-001", customer: "Lena Hartman", product: "Pro Plan", amount: "$249.00", status: "Completed", date: "Apr 17, 2026", method: "Visa *4242" },
    { id: "#ORD-002", customer: "Marcus Webb", product: "Starter Plan", amount: "$49.00", status: "Pending", date: "Apr 17, 2026", method: "PayPal" },
    { id: "#ORD-003", customer: "Priya Nair", product: "Enterprise", amount: "$999.00", status: "Completed", date: "Apr 16, 2026", method: "Visa *1234" },
    { id: "#ORD-004", customer: "Daniel Song", product: "Pro Plan", amount: "$249.00", status: "Failed", date: "Apr 16, 2026", method: "MC *9876" },
    { id: "#ORD-005", customer: "Aisha Kamara", product: "Starter Plan", amount: "$49.00", status: "Completed", date: "Apr 15, 2026", method: "Visa *5555" },
    { id: "#ORD-006", customer: "Tom Reeves", product: "Pro Plan", amount: "$249.00", status: "Pending", date: "Apr 15, 2026", method: "PayPal" },
    { id: "#ORD-007", customer: "Sofia Ruiz", product: "Enterprise", amount: "$999.00", status: "Completed", date: "Apr 14, 2026", method: "Amex *3737" },
    { id: "#ORD-008", customer: "Kenji Tanaka", product: "Starter Plan", amount: "$49.00", status: "Refunded", date: "Apr 14, 2026", method: "Visa *2020" },
    { id: "#ORD-009", customer: "Lena Hartman", product: "Enterprise", amount: "$999.00", status: "Completed", date: "Apr 13, 2026", method: "Visa *4242" },
    { id: "#ORD-010", customer: "Marcus Webb", product: "Pro Plan", amount: "$249.00", status: "Completed", date: "Apr 13, 2026", method: "PayPal" },
  ];

  const statusStyles: Record<string, string> = {
    Completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Refunded: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  const statuses = ["All", "Completed", "Pending", "Failed", "Refunded"];
  const PAGE_SIZE = 6;

  let query = $state("");
  let page = $state(0);
  let sortAsc = $state(false);
  let statusFilter = $state("All");

  const filtered = $derived(
    allOrders
      .filter((o) => statusFilter === "All" || o.status === statusFilter)
      .filter(
        (o) =>
          o.customer.toLowerCase().includes(query.toLowerCase()) ||
          o.id.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) =>
        sortAsc ? a.amount.localeCompare(b.amount) : b.amount.localeCompare(a.amount)
      )
  );
  const paginated = $derived(filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE));
  const totalPages = $derived(Math.ceil(filtered.length / PAGE_SIZE));
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-base font-semibold text-foreground">Orders</h2>
      <p class="text-xs text-muted-foreground mt-0.5">{allOrders.length} total orders</p>
    </div>
    <Button variant="outline" size="sm" class="gap-1.5 text-xs">
      <Download class="w-3.5 h-3.5" />
      Export
    </Button>
  </div>

  <Card class="p-5 flex flex-col gap-4">
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1 max-w-xs">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10"
        />
        <Input
          class="pl-8 text-sm"
          placeholder="Search orders..."
          bind:value={query}
          oninput={() => (page = 0)}
        />
      </div>
      <div class="flex gap-1">
        {#each statuses as s}
          <button
            type="button"
            onclick={() => {
              statusFilter = s;
              page = 0;
            }}
            class={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {s}
          </button>
        {/each}
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border">
            <th class="text-left pb-2.5 text-xs font-medium text-muted-foreground">Order</th>
            <th class="text-left pb-2.5 text-xs font-medium text-muted-foreground"
              >Customer</th
            >
            <th
              class="text-left pb-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell"
              >Product</th
            >
            <th class="text-right pb-2.5 text-xs font-medium text-muted-foreground">
              <button
                type="button"
                class="flex items-center gap-1 ml-auto hover:text-foreground"
                onclick={() => (sortAsc = !sortAsc)}
              >
                Amount <ArrowUpDown class="w-3 h-3" />
              </button>
            </th>
            <th
              class="text-left pb-2.5 text-xs font-medium text-muted-foreground pl-4 hidden sm:table-cell"
              >Status</th
            >
            <th
              class="text-left pb-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell"
              >Method</th
            >
            <th
              class="text-left pb-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell"
              >Date</th
            >
            <th class="pb-2.5"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          {#each paginated as order (order.id)}
            <tr class="hover:bg-muted/40 transition-colors">
              <td class="py-2.5 text-xs font-mono text-muted-foreground">{order.id}</td>
              <td class="py-2.5 font-medium text-foreground text-xs">{order.customer}</td>
              <td class="py-2.5 text-xs text-muted-foreground hidden md:table-cell"
                >{order.product}</td
              >
              <td class="py-2.5 text-right font-medium text-foreground text-xs"
                >{order.amount}</td
              >
              <td class="py-2.5 pl-4 hidden sm:table-cell">
                <span
                  class={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    statusStyles[order.status]
                  )}
                >
                  {order.status}
                </span>
              </td>
              <td class="py-2.5 text-xs text-muted-foreground hidden lg:table-cell"
                >{order.method}</td
              >
              <td class="py-2.5 text-xs text-muted-foreground hidden lg:table-cell"
                >{order.date}</td
              >
              <td class="py-2.5">
                <Button variant="ghost" size="icon" class="w-7 h-7" aria-label="Order actions">
                  <MoreHorizontal class="w-3.5 h-3.5" />
                </Button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if paginated.length === 0}
        <p class="text-center text-sm text-muted-foreground py-8">No orders found.</p>
      {/if}
    </div>

    <div class="flex items-center justify-between pt-1 border-t border-border">
      <span class="text-xs text-muted-foreground">
        {filtered.length === 0
          ? "0"
          : `${page * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE + PAGE_SIZE, filtered.length)}`}
        of {filtered.length}
      </span>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="w-7 h-7"
          onclick={() => (page -= 1)}
          disabled={page === 0}
          aria-label="Previous"
        >
          <ChevronLeft class="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="w-7 h-7"
          onclick={() => (page += 1)}
          disabled={page >= totalPages - 1}
          aria-label="Next"
        >
          <ChevronRight class="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  </Card>
</div>
