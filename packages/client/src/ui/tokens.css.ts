// Top-level CSS for the shadow root. Injected once by overlay.ts via a <style> element.
export const ROOT_CSS = `
:host { all: initial;
  --k-z: 2147483647;
  --k-z-outline: 2147483646;
  --k-bg: #0b0b0f;
  --k-surface: #111;
  --k-fg: #eee;
  --k-muted: #9aa;
  --k-border: #222;
  --k-border-soft: #1a1a22;
  --k-accent: #2563eb;
  --k-accent-fg: #fff;
  --k-success: #22c55e;
  --k-warn: #f59e0b;
  --k-err: #ef4444;
  --k-hist-border: #1f2937;
  --k-blue-text: #93c5fd;
  --k-font: ui-sans-serif, system-ui, sans-serif;
  --k-mono: ui-monospace, monospace;
}
* { box-sizing: border-box; font-family: var(--k-font); }
@keyframes k-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
`;
