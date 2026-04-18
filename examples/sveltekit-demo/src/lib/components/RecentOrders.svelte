<script lang="ts">
  import Card from "./ui/Card.svelte";
  import Button from "./ui/Button.svelte";
  import { ArrowUpDown, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-svelte";
  import { cn } from "$lib/utils";

  const orders = [
    { id: "#ORD-001", customer: "Lena Hartman", product: "Pro Plan", amount: "$249.00", status: "Completed", date: "Apr 17, 2026" },
    { id: "#ORD-002", customer: "Marcus Webb", product: "Starter Plan", amount: "$49.00", status: "Pending", date: "Apr 17, 2026" },
    { id: "#ORD-003", customer: "Priya Nair", product: "Enterprise", amount: "$999.00", status: "Completed", date: "Apr 16, 2026" },
    { id: "#ORD-004", customer: "Daniel Song", product: "Pro Plan", amount: "$249.00", status: "Failed", date: "Apr 16, 2026" },
    { id: "#ORD-005", customer: "Aisha Kamara", product: "Starter Plan", amount: "$49.00", status: "Completed", date: "Apr 15, 2026" },
    { id: "#ORD-006", customer: "Tom Reeves", product: "Pro Plan", amount: "$249.00", status: "Pending", date: "Apr 15, 2026" },
    { id: "#ORD-007", customer: "Sofia Ruiz", product: "Enterprise", amount: "$999.00", status: "Completed", date: "Apr 14, 2026" },
    { id: "#ORD-008", customer: "Kenji Tanaka", product: "Starter Plan", amount: "$49.00", status: "Refunded", date: "Apr 14, 2026" },
  ];

  const statusStyles: Record<string, string> = {
    Completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Refunded: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };

  const PAGE_SIZE = 5;

  let page = $state(0);
  let sortAsc = $state(false);

  const sorted = $derived(
    [...orders].sort((a, b) =>
      sortAsc ? a.customer.localeCompare(b.customer) : b.customer.localeCompare(a.customer)
    )
  );
  const paginated = $derived(sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE));
  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
</script>

<Card class="p-5 flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-sm font-semibold text-foreground">Recent Orders</h2>
      <p class="text-xs text-muted-foreground mt-0.5">Last 30 days of transactions</p>
    </div>
    <Button variant="outline" size="sm" class="text-xs">Export CSV</Button>
  </div>

  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-border">
          <th class="text-left pb-2.5 text-xs font-medium text-muted-foreground">Order ID</th>
          <th class="text-left pb-2.5 text-xs font-medium text-muted-foreground">
            <button
              type="button"
              class="flex items-center gap-1 hover:text-foreground transition-colors"
              onclick={() => (sortAsc = !sortAsc)}
            >
              Customer <ArrowUpDown class="w-3 h-3" />
            </button>
          </th>
          <th
            class="text-left pb-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell"
            >Product</th
          >
          <th class="text-right pb-2.5 text-xs font-medium text-muted-foreground">Amount</th>
          <th
            class="text-left pb-2.5 text-xs font-medium text-muted-foreground pl-4 hidden sm:table-cell"
            >Status</th
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
            <td class="py-2.5 font-medium text-foreground">{order.customer}</td>
            <td class="py-2.5 text-muted-foreground hidden md:table-cell">{order.product}</td>
            <td class="py-2.5 text-right font-medium text-foreground">{order.amount}</td>
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
            <td class="py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
              {order.date}
            </td>
            <td class="py-2.5">
              <Button variant="ghost" size="icon" class="w-7 h-7" aria-label="More options">
                <MoreHorizontal class="w-3.5 h-3.5" />
              </Button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="flex items-center justify-between pt-1 border-t border-border">
    <span class="text-xs text-muted-foreground">
      Showing {page * PAGE_SIZE + 1}–{Math.min(
        page * PAGE_SIZE + PAGE_SIZE,
        orders.length
      )} of {orders.length}
    </span>
    <div class="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        class="w-7 h-7"
        onclick={() => (page -= 1)}
        disabled={page === 0}
        aria-label="Previous page"
      >
        <ChevronLeft class="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="w-7 h-7"
        onclick={() => (page += 1)}
        disabled={page >= totalPages - 1}
        aria-label="Next page"
      >
        <ChevronRight class="w-3.5 h-3.5" />
      </Button>
    </div>
  </div>
</Card>
