import { mountOverlay } from "./overlay.js";

declare global {
  interface Window {
    __KONSTNER__?: { port: number };
    __KONSTNER_MOUNTED__?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__KONSTNER_MOUNTED__) {
  window.__KONSTNER_MOUNTED__ = true;
  const port = window.__KONSTNER__?.port ?? 5177;
  mountOverlay({ port });
}
