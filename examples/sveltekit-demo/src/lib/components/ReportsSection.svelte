<script lang="ts">
  import Card from "./ui/Card.svelte";
  import Button from "./ui/Button.svelte";
  import Input from "./ui/Input.svelte";
  import Label from "./ui/Label.svelte";
  import {
    FileText,
    Download,
    Calendar,
    TrendingUp,
    Users,
    DollarSign,
    X,
    Clock,
  } from "lucide-svelte";

  let dialogOpen = $state(false);
  let newTitle = $state("");
  let newDescription = $state("");
  let newType = $state("PDF");
  let newFile = $state<File | null>(null);

  function openDialog() {
    newTitle = "";
    newDescription = "";
    newType = "PDF";
    newFile = null;
    dialogOpen = true;
  }

  function createReport() {
    if (!newTitle.trim()) return;
    reports = [
      {
        title: newTitle,
        description: newDescription || "New report.",
        icon: FileText,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        size: "— KB",
        type: newType,
        colorClass: "bg-slate-100 text-slate-700",
      },
      ...reports,
    ];
    dialogOpen = false;
  }

  let reports = $state([
    {
      title: "Monthly Revenue Report",
      description: "Full breakdown of revenue, refunds, and MRR growth for March 2026.",
      icon: DollarSign,
      date: "Apr 1, 2026",
      size: "284 KB",
      type: "PDF",
      colorClass: "bg-amber-100 text-amber-700",
    },
    {
      title: "User Growth Analysis",
      description: "New signups, churn rate, and cohort retention data for Q1 2026.",
      icon: Users,
      date: "Apr 1, 2026",
      size: "192 KB",
      type: "PDF",
      colorClass: "bg-emerald-100 text-emerald-700",
    },
    {
      title: "Performance Metrics Q1",
      description: "Core Web Vitals, uptime, and API latency benchmarks for Q1 2026.",
      icon: TrendingUp,
      date: "Apr 1, 2026",
      size: "140 KB",
      type: "PDF",
      colorClass: "bg-sky-100 text-sky-700",
    },
    {
      title: "Scheduled: Weekly Digest",
      description: "Automated weekly summary — next generation scheduled for Apr 20, 2026.",
      icon: Calendar,
      date: "Every Monday",
      size: "—",
      type: "Scheduled",
      colorClass: "bg-teal-100 text-teal-700",
    },
  ]);
</script>

<div class="flex flex-col gap-6">
  <div class="flex items-end justify-between">
    <div class="relative pl-3">
      <div class="absolute left-0 top-1 w-1 h-6 rounded-full bg-amber-500"></div>
      <h2 class="text-2xl font-bold tracking-tight text-foreground">Reports</h2>
      <p class="text-sm text-muted-foreground mt-1">Download and schedule reports</p>
    </div>
    <Button size="sm" class="gap-1.5" onclick={openDialog}>
      <FileText class="w-4 h-4" />
      New Report
    </Button>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    {#each reports as report, i (report.title)}
      <Card
        class="p-5 flex flex-col gap-5 transition duration-200 hover:shadow-md hover:-translate-y-0.5 {report.type === 'Scheduled' ? 'border-dashed' : ''}"
        style="animation: fadeInUp 0.5s ease-out both; animation-delay: {i * 80}ms;"
      >
        <div class="flex items-start gap-4">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 {report.colorClass}"
          >
            <report.icon class="w-5 h-5" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-foreground leading-tight text-sm">
              {report.title}
            </p>
            <p class="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {report.description}
            </p>
          </div>
        </div>
        <div class="flex items-center justify-between pt-3 border-t border-border/60">
          <div class="flex items-center gap-3 text-xs text-muted-foreground">
            <span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              {report.type}
            </span>
            <span class="flex items-center gap-1.5">
              {#if report.type === "Scheduled"}
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              {/if}
              {report.date}
            </span>
            {#if report.size !== "—"}
              <span>·</span>
              <span>{report.size}</span>
            {/if}
          </div>
          {#if report.type !== "Scheduled"}
            <Button variant="ghost" size="sm" class="gap-1.5 text-xs h-7 px-2.5">
              <Download class="w-3.5 h-3.5" />
              Download
            </Button>
          {:else}
            <span class="text-xs text-muted-foreground flex items-center gap-1">
              <Clock class="w-3 h-3" />
              Recurring
            </span>
          {/if}
        </div>
      </Card>    {/each}
  </div>
</div>

{#if dialogOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    onclick={() => (dialogOpen = false)}
    role="presentation"
  >
    <div
      class="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-report-title"
    >
      <div class="flex items-start justify-between mb-4">
        <div>
          <h3 id="new-report-title" class="text-base font-semibold text-foreground">Create New Report</h3>
          <p class="text-xs text-muted-foreground mt-0.5">Configure a new report to generate.</p>
        </div>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground"
          onclick={() => (dialogOpen = false)}
          aria-label="Close"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <form class="flex flex-col gap-4" onsubmit={(e) => { e.preventDefault(); createReport(); }}>
        <div class="flex flex-col gap-1.5">
          <Label for="report-title">Title</Label>
          <Input id="report-title" bind:value={newTitle} placeholder="e.g. Q2 Revenue Report" required />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="report-description">Description</Label>
          <Input id="report-description" bind:value={newDescription} placeholder="Short summary of the report" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="report-file">File</Label>
          <label
            for="report-file"
            class="flex flex-col items-center justify-center gap-1 h-28 w-full rounded-md border border-dashed border-input bg-transparent px-3 py-2 text-sm text-muted-foreground shadow-sm cursor-pointer hover:bg-accent/30"
            ondragover={(e) => e.preventDefault()}
            ondrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer?.files?.[0];
              if (f) { newFile = f; newType = (f.name.split('.').pop() ?? 'PDF').toUpperCase(); }
            }}
          >
            {#if newFile}
              <span class="text-foreground font-medium">{newFile.name}</span>
              <span class="text-xs">{(newFile.size / 1024).toFixed(1)} KB</span>
            {:else}
              <span>Drop a file here or click to browse</span>
              <span class="text-xs">PDF, CSV, or other formats</span>
            {/if}
          </label>
          <input
            id="report-file"
            type="file"
            class="hidden"
            onchange={(e) => {
              const f = e.currentTarget.files?.[0];
              if (f) { newFile = f; newType = (f.name.split('.').pop() ?? 'PDF').toUpperCase(); }
            }}
          />
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onclick={() => (dialogOpen = false)}>Cancel</Button>
          <Button type="submit" size="sm">Create Report</Button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
