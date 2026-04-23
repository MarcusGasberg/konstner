<script lang="ts">
  import { useAppContext } from "../stores/context.js";
  const { hover, selection } = useAppContext();

  let hoverRect = $state<DOMRect | null>(null);
  let selectedRect = $state<DOMRect | null>(null);

  function recompute() {
    hoverRect = hover.target ? hover.target.getBoundingClientRect() : null;
    selectedRect = selection.element
      ? selection.element.getBoundingClientRect()
      : null;
  }

  $effect(() => {
    // Track reactive deps then recompute.
    void hover.target;
    void selection.element;
    recompute();
  });

  $effect(() => {
    const onScroll = () => recompute();
    const onResize = () => recompute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  });
</script>

{#if hoverRect}
  <div
    class="outline"
    style:top="{hoverRect.top}px"
    style:left="{hoverRect.left}px"
    style:width="{hoverRect.width}px"
    style:height="{hoverRect.height}px"
  ></div>
{/if}
{#if selectedRect}
  <div
    class="outline selected"
    style:top="{selectedRect.top}px"
    style:left="{selectedRect.left}px"
    style:width="{selectedRect.width}px"
    style:height="{selectedRect.height}px"
  ></div>
{/if}

<style>
  .outline {
    position: fixed;
    pointer-events: none;
    z-index: var(--k-z-outline);
    border: 2px solid var(--k-accent);
    background: rgba(37, 99, 235, 0.08);
    transition: all 50ms linear;
  }
  .outline.selected {
    border-color: var(--k-success);
    background: rgba(34, 197, 94, 0.08);
  }
</style>
