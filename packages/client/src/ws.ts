import {
  WS_PATH,
  type ClientToServer,
  type ServerToClient,
} from "@konstner/core";

export interface WsClient {
  send(msg: ClientToServer): void;
  onMessage(fn: (msg: ServerToClient) => void): () => void;
  close(): void;
}

export function connectWs(port: number): WsClient {
  let ws: WebSocket | null = null;
  const listeners = new Set<(msg: ServerToClient) => void>();
  let queue: string[] = [];
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function open() {
    ws = new WebSocket(`ws://127.0.0.1:${port}${WS_PATH}`);
    ws.addEventListener("open", () => {
      const q = queue;
      queue = [];
      for (const m of q) ws?.send(m);
    });
    ws.addEventListener("message", (e) => {
      try {
        const msg = JSON.parse(e.data) as ServerToClient;
        for (const l of listeners) l(msg);
      } catch {
        // ignore
      }
    });
    ws.addEventListener("close", () => {
      if (reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        open();
      }, 1000);
    });
    ws.addEventListener("error", () => {
      ws?.close();
    });
  }

  open();

  return {
    send(msg) {
      const json = JSON.stringify(msg);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(json);
      else queue.push(json);
    },
    onMessage(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      ws?.close();
    },
  };
}
