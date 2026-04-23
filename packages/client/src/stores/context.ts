import { getContext, setContext } from "svelte";
import type { Picker } from "../picker.js";
import type { WsClient } from "../ws.js";
import type { HistoryStore } from "./history.svelte.js";
import type { HoverStore } from "./hover.svelte.js";
import type { PanelStore } from "./panel.svelte.js";
import type { ScanStore } from "./scan.svelte.js";
import type { SelectionStore } from "./selection.svelte.js";
import type { ToastsStore } from "./toasts.svelte.js";

export interface AppContext {
  ws: WsClient;
  picker: Picker;
  selection: SelectionStore;
  hover: HoverStore;
  history: HistoryStore;
  panel: PanelStore;
  scan: ScanStore;
  toasts: ToastsStore;
}

const KEY = Symbol("konstner.app");

export function provideAppContext(ctx: AppContext): void {
  setContext(KEY, ctx);
}

export function useAppContext(): AppContext {
  const ctx = getContext<AppContext>(KEY);
  if (!ctx) throw new Error("konstner AppContext not provided");
  return ctx;
}
