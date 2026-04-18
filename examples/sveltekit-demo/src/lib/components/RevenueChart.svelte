<script lang="ts">
  import Card from "./ui/Card.svelte";

  const data = [
    { month: "Jan", revenue: 42000, expenses: 28000 },
    { month: "Feb", revenue: 47500, expenses: 30000 },
    { month: "Mar", revenue: 53200, expenses: 32500 },
    { month: "Apr", revenue: 49800, expenses: 29000 },
    { month: "May", revenue: 61000, expenses: 35000 },
    { month: "Jun", revenue: 58400, expenses: 33500 },
    { month: "Jul", revenue: 67200, expenses: 38000 },
    { month: "Aug", revenue: 72100, expenses: 40000 },
    { month: "Sep", revenue: 68900, expenses: 37500 },
    { month: "Oct", revenue: 79300, expenses: 42000 },
    { month: "Nov", revenue: 81500, expenses: 44000 },
    { month: "Dec", revenue: 84320, expenses: 46500 },
  ];

  const W = 600;
  const H = 220;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxY = 90000;
  const yTicks = [0, 30000, 60000, 90000];

  function x(i: number) {
    return padL + (i * innerW) / (data.length - 1);
  }
  function y(v: number) {
    return padT + innerH - (v / maxY) * innerH;
  }
  function linePath(key: "revenue" | "expenses") {
    return data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");
  }
  function areaPath(key: "revenue" | "expenses") {
    return `${linePath(key)} L ${x(data.length - 1)} ${padT + innerH} L ${x(0)} ${padT + innerH} Z`;
  }
</script>

<Card class="p-5 flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-sm font-semibold text-foreground">Revenue vs Expenses</h2>
      <p class="text-xs text-muted-foreground mt-0.5">Full year overview — 2025</p>
    </div>
    <div class="flex items-center gap-4 text-xs">
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
        <span class="text-muted-foreground">Revenue</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block"></span>
        <span class="text-muted-foreground">Expenses</span>
      </div>
    </div>
  </div>

  <svg viewBox="0 0 {W} {H}" class="w-full h-[220px]" preserveAspectRatio="none">
    <defs>
      <linearGradient id="grad-revenue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stop-color="#3b82f6" stop-opacity="0.25" />
        <stop offset="95%" stop-color="#3b82f6" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="grad-expenses" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stop-color="#fb923c" stop-opacity="0.25" />
        <stop offset="95%" stop-color="#fb923c" stop-opacity="0" />
      </linearGradient>
    </defs>

    {#each yTicks as t}
      <line
        x1={padL}
        x2={W - padR}
        y1={y(t)}
        y2={y(t)}
        stroke="currentColor"
        stroke-dasharray="3 3"
        class="text-border"
        opacity="0.5"
      />
      <text
        x={padL - 6}
        y={y(t) + 3}
        text-anchor="end"
        class="fill-muted-foreground"
        font-size="11">${t / 1000}k</text
      >
    {/each}

    <path d={areaPath("revenue")} fill="url(#grad-revenue)" />
    <path d={linePath("revenue")} fill="none" stroke="#3b82f6" stroke-width="2" />
    <path d={areaPath("expenses")} fill="url(#grad-expenses)" />
    <path d={linePath("expenses")} fill="none" stroke="#fb923c" stroke-width="2" />

    {#each data as d, i}
      <text
        x={x(i)}
        y={H - 6}
        text-anchor="middle"
        class="fill-muted-foreground"
        font-size="11">{d.month}</text
      >
    {/each}
  </svg>
</Card>
