import type { ClientToServer } from "@konstner/core";
import { scanPage, type ScanResult } from "../scan.js";

export interface ScanStoreDeps {
  send(msg: ClientToServer): void;
  scanner?: () => ScanResult;
  idGen?: () => string;
}

export interface ScanStore {
  readonly result: ScanResult | null;
  readonly visible: boolean;
  run(): void;
  close(): void;
}

function defaultIdGen(): string {
  return `scan_${Date.now().toString(36)}`;
}

export function createScanStore(deps: ScanStoreDeps): ScanStore {
  const idGen = deps.idGen ?? defaultIdGen;
  const scanner = deps.scanner ?? scanPage;
  let result = $state.raw<ScanResult | null>(null);
  let visible = $state(false);
  return {
    get result() {
      return result;
    },
    get visible() {
      return visible;
    },
    run() {
      const r = scanner();
      result = r;
      visible = true;
      deps.send({ type: "scan_page", id: idGen(), findings: r.findings });
    },
    close() {
      visible = false;
    },
  };
}
