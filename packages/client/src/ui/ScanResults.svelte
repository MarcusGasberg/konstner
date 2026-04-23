<script lang="ts">
  import { useAppContext } from "../stores/context.js";
  const { scan } = useAppContext();

  const topFonts = $derived.by(() => {
    if (!scan.result) return "";
    return Array.from(scan.result.stats.fontFamilies.entries())
      .slice(0, 3)
      .map(([f, c]) => `${f} (${c})`)
      .join(", ") || "none";
  });

  const headingSummary = $derived.by(() => {
    if (!scan.result) return "";
    const hs = scan.result.stats.headings;
    return hs.length > 0
      ? `Headings: ${hs.map((h) => `h${h.level}`).join(", ")}`
      : "No headings found";
  });
</script>

{#if scan.visible && scan.result}
  <div class="panel" role="region" aria-label="Design scan results">
    <div class="title">Design Scan ({scan.result.stats.elementsScanned} elements)</div>
    {#if scan.result.findings.length === 0}
      <div class="message">No design issues found.</div>
    {:else}
      {#each scan.result.findings as f, i (i)}
        <div class="finding">
          <div class="rule {f.severity}">{f.rule}</div>
          <div class="message">{f.message}</div>
        </div>
      {/each}
    {/if}
    <div class="stats">
      {headingSummary} | Fonts: {topFonts} | Centered: {scan.result.stats.centeredElements}
    </div>
    <button class="ghost" onclick={() => scan.close()}>Close</button>
  </div>
{/if}

<style>
  .panel {
    position: fixed; right: 16px; bottom: 72px; z-index: var(--k-z);
    width: 360px; max-height: calc(100vh - 120px); overflow-y: auto;
    background: var(--k-bg); color: var(--k-fg);
    border: 1px solid var(--k-border); border-radius: 12px;
    padding: 12px; font-size: 13px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }
  .title {
    margin: 0 0 8px 0; font-size: 11px; color: var(--k-muted);
    letter-spacing: 0.1em; text-transform: uppercase;
  }
  .finding { padding: 8px 0; border-top: 1px solid var(--k-border-soft); }
  .finding:first-of-type { border-top: none; }
  .rule { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  .rule.error { color: var(--k-err); }
  .rule.warning { color: var(--k-warn); }
  .rule.info { color: #60a5fa; }
  .message { color: #ccc; font-size: 12px; margin-top: 2px; }
  .stats {
    color: #6b7280; font-size: 11px; margin-top: 8px;
    padding-top: 8px; border-top: 1px solid var(--k-border-soft);
  }
  .ghost {
    background: transparent; color: #aaa; border: 1px solid #333;
    padding: 6px 10px; border-radius: 6px; cursor: pointer; margin-top: 8px;
  }
</style>
