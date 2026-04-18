<script lang="ts">
  import Card from "./ui/Card.svelte";

  const data = [
    { name: "Organic", value: 42, color: "#3b82f6" },
    { name: "Paid", value: 28, color: "#8b5cf6" },
    { name: "Referral", value: 18, color: "#fb923c" },
    { name: "Direct", value: 12, color: "#22c55e" },
  ];

  const cx = 110;
  const cy = 110;
  const rOuter = 90;
  const rInner = 60;
  const total = data.reduce((s, d) => s + d.value, 0);

  function arc(startAngle: number, endAngle: number) {
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const [x1, y1] = p(rOuter, startAngle);
    const [x2, y2] = p(rOuter, endAngle);
    const [x3, y3] = p(rInner, endAngle);
    const [x4, y4] = p(rInner, startAngle);
    return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
  }

  let acc = -Math.PI / 2;
  const slices = data.map((d) => {
    const angle = (d.value / total) * Math.PI * 2;
    const start = acc + 0.02;
    const end = acc + angle - 0.02;
    acc += angle;
    return { ...d, path: arc(start, end) };
  });
</script>

<Card class="p-5 flex flex-col gap-4">
  <div>
    <h2 class="text-sm font-semibold text-foreground">Traffic Sources</h2>
    <p class="text-xs text-muted-foreground mt-0.5">Breakdown by acquisition channel</p>
  </div>
  <div class="flex items-center gap-6">
    <svg viewBox="0 0 220 220" class="h-[180px] w-[180px] shrink-0">
      {#each slices as s}
        <path d={s.path} fill={s.color} />
      {/each}
    </svg>
    <ul class="space-y-2 text-xs">
      {#each data as d}
        <li class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full inline-block" style="background:{d.color}"
          ></span>
          <span class="text-muted-foreground">{d.name}</span>
          <span class="text-foreground font-medium ml-auto">{d.value}%</span>
        </li>
      {/each}
    </ul>
  </div>
</Card>
