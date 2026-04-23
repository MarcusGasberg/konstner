import { mount, unmount } from "svelte";
import type { ServerToClient } from "@konstner/core";
import App from "./ui/App.svelte";
import { Picker } from "./picker.js";
import { ROOT_CSS } from "./ui/tokens.css.js";
import { connectWs } from "./ws.js";
import { createHistoryStore } from "./stores/history.svelte.js";
import { createHoverStore } from "./stores/hover.svelte.js";
import { createPanelStore } from "./stores/panel.svelte.js";
import { createScanStore } from "./stores/scan.svelte.js";
import { createSelectionStore } from "./stores/selection.svelte.js";
import { createToastsStore } from "./stores/toasts.svelte.js";
import type { AppContext } from "./stores/context.js";

export interface OverlayHandle {
  destroy(): void;
}

export function mountOverlay(opts: { port: number }): OverlayHandle {
  const host = document.createElement("div");
  host.id = "konstner-overlay-host";
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "open" });

  const rootStyle = document.createElement("style");
  rootStyle.textContent = ROOT_CSS;
  shadow.appendChild(rootStyle);

  const ws = connectWs(opts.port);

  const toasts = createToastsStore();
  const selection = createSelectionStore({ send: ws.send });
  const hover = createHoverStore();
  const history = createHistoryStore({ send: ws.send });
  const panel = createPanelStore();
  const scan = createScanStore({ send: ws.send });

  const picker = new Picker(host, {
    onHover(el) {
      hover.set(el);
    },
    onSelect(sel) {
      selection.setFromPicker(sel);
    },
    onActiveChange(active) {
      hover.setActive(active);
    },
  });

  const offMessage = ws.onMessage((msg: ServerToClient) => {
    if (msg.type === "toast") {
      toasts.push(msg.level, msg.message);
    } else if (msg.type === "request_resolved") {
      history.handleResolved({ id: msg.id, summary: msg.summary });
    } else if (msg.type === "edit_applied") {
      toasts.push("success", `Applied ${msg.edits.length} edit(s).`);
    } else if (msg.type === "request_reverted") {
      history.handleReverted({ threadId: msg.threadId, files: msg.files });
      toasts.push("success", `Reverted ${msg.files.length} file(s).`);
    }
  });

  const ctx: AppContext = {
    ws,
    picker,
    selection,
    hover,
    history,
    panel,
    scan,
    toasts,
  };

  const appInstance = mount(App, { target: shadow, props: { ctx } });

  document.body.appendChild(host);

  return {
    destroy() {
      offMessage();
      unmount(appInstance);
      ws.close();
      picker.stop();
      host.remove();
    },
  };
}
