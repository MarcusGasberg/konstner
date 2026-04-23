<script lang="ts">
  import { useAppContext } from "../stores/context.js";
  const { panel, picker } = useAppContext();

  function onClick() {
    panel.toggle();
    if (panel.open) picker.start();
    else picker.stop();
  }
</script>

<button
  class="fab"
  class:active={panel.open}
  onclick={onClick}
  title="Konstner (pick element)"
  aria-label="Toggle Konstner"
>K</button>

<style>
  .fab {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: var(--k-z);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: var(--k-surface);
    color: #fff;
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }
  .fab.active { background: var(--k-accent); }
</style>
