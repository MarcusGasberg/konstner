export type ToastLevel = "info" | "success" | "error";

export interface Toast {
  id: string;
  level: ToastLevel;
  message: string;
}

export interface ToastsStore {
  readonly items: Toast[];
  push(level: ToastLevel, message: string): string;
  dismiss(id: string): void;
}

let nextId = 0;
function makeId(): string {
  nextId += 1;
  return `t_${Date.now().toString(36)}_${nextId}`;
}

export function createToastsStore(): ToastsStore {
  const items = $state<Toast[]>([]);
  return {
    get items() {
      return items;
    },
    push(level, message) {
      const id = makeId();
      items.push({ id, level, message });
      return id;
    },
    dismiss(id) {
      const idx = items.findIndex((t) => t.id === id);
      if (idx >= 0) items.splice(idx, 1);
    },
  };
}
