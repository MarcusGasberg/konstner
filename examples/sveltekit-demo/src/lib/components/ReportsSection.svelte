<script lang="ts">
  import Card from "./ui/Card.svelte";
  import Button from "./ui/Button.svelte";
  import {
    FileText,
    Download,
    Calendar,
    TrendingUp,
    Users,
    DollarSign,
  } from "lucide-svelte";

  const reports = [
    {
      title: "Monthly Revenue Report",
      description: "Full breakdown of revenue, refunds, and MRR growth for March 2026.",
      icon: DollarSign,
      date: "Apr 1, 2026",
      size: "284 KB",
      type: "PDF",
    },
    {
      title: "User Growth Analysis",
      description: "New signups, churn rate, and cohort retention data for Q1 2026.",
      icon: Users,
      date: "Apr 1, 2026",
      size: "192 KB",
      type: "PDF",
    },
    {
      title: "Performance Metrics Q1",
      description: "Core Web Vitals, uptime, and API latency benchmarks for Q1 2026.",
      icon: TrendingUp,
      date: "Apr 1, 2026",
      size: "140 KB",
      type: "PDF",
    },
    {
      title: "Scheduled: Weekly Digest",
      description: "Automated weekly summary — next generation scheduled for Apr 20, 2026.",
      icon: Calendar,
      date: "Every Monday",
      size: "—",
      type: "Scheduled",
    },
  ];
</script>

<div class="flex flex-col gap-4">
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-base font-semibold text-foreground">Reports</h2>
      <p class="text-xs text-muted-foreground mt-0.5">Download and schedule reports</p>
    </div>
    <Button size="sm" class="gap-1.5">
      <FileText class="w-3.5 h-3.5" />
      New Report
    </Button>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    {#each reports as report (report.title)}
      <Card class="p-5 flex flex-col gap-4">
        <div class="flex items-start gap-3">
          <div
            class="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0"
          >
            <report.icon class="w-4 h-4 text-foreground" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-foreground leading-tight">
              {report.title}
            </p>
            <p class="text-xs text-muted-foreground mt-1 leading-relaxed">
              {report.description}
            </p>
          </div>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-border">
          <div class="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{report.date}</span>
            {#if report.size !== "—"}
              <span>·</span>
              <span>{report.size}</span>
            {/if}
            <span>·</span>
            <span class="font-medium text-foreground">{report.type}</span>
          </div>
          {#if report.type !== "Scheduled"}
            <Button variant="ghost" size="sm" class="gap-1.5 text-xs h-7 px-2.5">
              <Download class="w-3.5 h-3.5" />
              Download
            </Button>
          {/if}
        </div>
      </Card>
    {/each}
  </div>
</div>
