import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import App from "./App.svelte";
import { createToastsStore } from "../stores/toasts.svelte.js";
import { createSelectionStore } from "../stores/selection.svelte.js";
import { createHoverStore } from "../stores/hover.svelte.js";
import { createHistoryStore } from "../stores/history.svelte.js";
import { createPanelStore } from "../stores/panel.svelte.js";
import { createScanStore } from "../stores/scan.svelte.js";

afterEach(() => cleanup());

function makeCtx() {
  const send = vi.fn();
  const ws = { send, onMessage: () => () => {}, close: () => {} };
  const picker = {
    start: vi.fn(),
    stop: vi.fn(),
    isActive: vi.fn(() => false),
  } as unknown as import("../picker.js").Picker;
  const toasts = createToastsStore();
  const selection = createSelectionStore({ send });
  const hover = createHoverStore();
  const history = createHistoryStore({ send });
  const panel = createPanelStore();
  const scan = createScanStore({
    send,
    scanner: () => ({
      findings: [],
      stats: {
        elementsScanned: 0,
        headings: [],
        fontFamilies: new Map(),
        centeredElements: 0,
      },
    }),
  });
  return { ws, picker, toasts, selection, hover, history, panel, scan };
}

describe("App smoke", () => {
  it("renders the fab", () => {
    const { getByLabelText } = render(App, { props: { ctx: makeCtx() } });
    expect(getByLabelText("Toggle Konstner")).toBeInTheDocument();
  });

  it("fab click opens panel via store", () => {
    const ctx = makeCtx();
    const { getByLabelText } = render(App, { props: { ctx } });
    expect(ctx.panel.open).toBe(false);
    (getByLabelText("Toggle Konstner") as HTMLButtonElement).click();
    expect(ctx.panel.open).toBe(true);
  });
});
