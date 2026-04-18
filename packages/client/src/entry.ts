// Re-export for convenience. Framework-agnostic side-effect auto-mount
// lives in `./auto.ts`; the explicit mount function is in `./index.ts`.
export { mountOverlay } from "./overlay.js";
export type { OverlayHandle } from "./overlay.js";
