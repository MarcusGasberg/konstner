<script lang="ts">
  import Card from "./ui/Card.svelte";

  const weeklyData = [
    { day: "Mon", sessions: 2400, pageviews: 5800 },
    { day: "Tue", sessions: 1398, pageviews: 4200 },
    { day: "Wed", sessions: 3200, pageviews: 7100 },
    { day: "Thu", sessions: 2780, pageviews: 6300 },
    { day: "Fri", sessions: 3890, pageviews: 8900 },
    { day: "Sat", sessions: 2390, pageviews: 5200 },
    { day: "Sun", sessions: 1490, pageviews: 3100 },
  ];

  const retentionData = [
    { week: "Wk 1", d1: 100, d7: 68, d30: 42 },
    { week: "Wk 2", d1: 100, d7: 71, d30: 45 },
    { week: "Wk 3", d1: 100, d7: 65, d30: 39 },
    { week: "Wk 4", d1: 100, d7: 74, d30: 48 },
    { week: "Wk 5", d1: 100, d7: 69, d30: 44 },
    { week: "Wk 6", d1: 100, d7: 77, d30: 52 },
  ];

  const topPages = [
    { page: "/dashboard", views: 14820, bounce: "32%" },
    { page: "/pricing", views: 9340, bounce: "48%" },
    { page: "/docs/getting-started", views: 7210, bounce: "25%" },
    { page: "/blog/release-2-4", views: 5890, bounce: "61%" },
    { page: "/login", views: 4320, bounce: "19%" },
  ];

  const BW = 600;
  const BH = 220;
  const bPad = { l: 40, r: 10, t: 10, b: 24 };
  const bInnerW = BW - bPad.l - bPad.r;
  const bInnerH = BH - bPad.t - bPad.b;
  const barMax = 10000;
  const barTicks = [0, 2500, 5000, 7500, 10000];
  const groupWidth = bInnerW / weeklyData.length;
  const barWidth = groupWidth / 3;

  function by(v: number) {
    return bPad.t + bInnerH - (v / barMax) * bInnerH;
  }

  const LW = 600;
  const LH = 200;
  const lPad = { l: 40, r: 10, t: 10, b: 24 };
  const lInnerW = LW - lPad.l - lPad.r;
  const lInnerH = LH - lPad.t - lPad.b;
  const lineTicks = [0, 25, 50, 75, 100];

  function lx(i: number) {
    return lPad.l + (i * lInnerW) / (retentionData.length - 1);
  }
  function ly(v: number) {
    return lPad.t + lInnerH - (v / 100) * lInnerH;
  }
  function linePath(key: "d1" | "d7" | "d30") {
    return retentionData
      .map((d, i) => `${i === 0 ? "M" : "L"} ${lx(i)} ${ly(d[key])}`)
      .join(" ");
  }
</script>

<div class="flex flex-col gap-4">
  <div>
    <h2 class="text-base font-semibold text-foreground">Analytics</h2>
    <p class="text-xs text-muted-foreground mt-0.5">Usage data for the last 7 days</p>
  </div>

  <Card class="p-5 flex flex-col gap-4">
    <div>
      <h3 class="text-sm font-semibold text-foreground">Sessions & Page Views</h3>
      <p class="text-xs text-muted-foreground mt-0.5">Daily traffic breakdown</p>
    </div>
    <svg viewBox="0 0 {BW} {BH}" class="w-full h-[220px]" preserveAspectRatio="none">
      {#each barTicks as t}
        <line
          x1={bPad.l}
          x2={BW - bPad.r}
          y1={by(t)}
          y2={by(t)}
          stroke="currentColor"
          stroke-dasharray="3 3"
          class="text-border"
          opacity="0.5"
        />
        <text
          x={bPad.l - 6}
          y={by(t) + 3}
          text-anchor="end"
          class="fill-muted-foreground"
          font-size="11">{t / 1000}k</text
        >
      {/each}

      {#each weeklyData as d, i}
        {@const gx = bPad.l + i * groupWidth + groupWidth / 2}
        <rect
          x={gx - barWidth}
          y={by(d.sessions)}
          width={barWidth - 2}
          height={bPad.t + bInnerH - by(d.sessions)}
          fill="#3b82f6"
          rx="3"
        />
        <rect
          x={gx + 2}
          y={by(d.pageviews)}
          width={barWidth - 2}
          height={bPad.t + bInnerH - by(d.pageviews)}
          fill="#8b5cf6"
          rx="3"
        />
        <text
          x={gx}
          y={BH - 6}
          text-anchor="middle"
          class="fill-muted-foreground"
          font-size="11">{d.day}</text
        >
      {/each}
    </svg>
    <div class="flex items-center gap-4 text-xs">
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
        <span class="text-muted-foreground">Sessions</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block"></span>
        <span class="text-muted-foreground">Page views</span>
      </div>
    </div>
  </Card>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <Card class="p-5 flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold text-foreground">User Retention</h3>
        <p class="text-xs text-muted-foreground mt-0.5">D1 / D7 / D30 retention rates</p>
      </div>
      <svg viewBox="0 0 {LW} {LH}" class="w-full h-[200px]" preserveAspectRatio="none">
        {#each lineTicks as t}
          <line
            x1={lPad.l}
            x2={LW - lPad.r}
            y1={ly(t)}
            y2={ly(t)}
            stroke="currentColor"
            stroke-dasharray="3 3"
            class="text-border"
            opacity="0.5"
          />
          <text
            x={lPad.l - 6}
            y={ly(t) + 3}
            text-anchor="end"
            class="fill-muted-foreground"
            font-size="11">{t}%</text
          >
        {/each}
        <path d={linePath("d1")} fill="none" stroke="#22c55e" stroke-width="2" />
        <path d={linePath("d7")} fill="none" stroke="#3b82f6" stroke-width="2" />
        <path d={linePath("d30")} fill="none" stroke="#fb923c" stroke-width="2" />
        {#each retentionData as d, i}
          <text
            x={lx(i)}
            y={LH - 6}
            text-anchor="middle"
            class="fill-muted-foreground"
            font-size="11">{d.week}</text
          >
        {/each}
      </svg>
      <div class="flex items-center gap-4 text-xs">
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
          <span class="text-muted-foreground">Day 1</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
          <span class="text-muted-foreground">Day 7</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block"></span>
          <span class="text-muted-foreground">Day 30</span>
        </div>
      </div>
    </Card>

    <Card class="p-5 flex flex-col gap-4">
      <div>
        <h3 class="text-sm font-semibold text-foreground">Top Pages</h3>
        <p class="text-xs text-muted-foreground mt-0.5">Most visited URLs this week</p>
      </div>
      <div class="space-y-3">
        {#each topPages as p, i (p.page)}
          <div class="flex items-center gap-3">
            <span class="text-xs font-mono text-muted-foreground w-4 text-right shrink-0"
              >{i + 1}</span
            >
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-foreground truncate">{p.page}</p>
              <div class="h-1 rounded-full bg-muted mt-1 overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary"
                  style="width: {(p.views / topPages[0].views) * 100}%"
                ></div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <p class="text-xs font-medium text-foreground">{p.views.toLocaleString()}</p>
              <p class="text-[10px] text-muted-foreground">bounce {p.bounce}</p>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  </div>
</div>
