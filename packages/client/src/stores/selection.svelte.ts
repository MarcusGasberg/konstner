import type { ClientToServer, ElementSelection } from "@konstner/core";

export interface SelectionStoreDeps {
  send(msg: ClientToServer): void;
}

export interface SelectionStore {
  readonly current: ElementSelection | null;
  readonly element: HTMLElement | null;
  setFromPicker(sel: ElementSelection): void;
  setWithoutPublishing(sel: ElementSelection | null): void;
  clear(): void;
}

function findByLoc(kLocId: string): HTMLElement | null {
  if (!kLocId) return null;
  return document.querySelector<HTMLElement>(
    `[data-k-loc="${CSS.escape(kLocId)}"]`,
  );
}

export function createSelectionStore(deps: SelectionStoreDeps): SelectionStore {
  let current = $state<ElementSelection | null>(null);
  const element = $derived(current ? findByLoc(current.kLocId) : null);

  return {
    get current() {
      return current;
    },
    get element() {
      return element;
    },
    setFromPicker(sel) {
      current = sel;
      deps.send({ type: "selection_changed", selection: sel });
    },
    setWithoutPublishing(sel) {
      current = sel;
    },
    clear() {
      current = null;
      deps.send({ type: "selection_changed", selection: null });
    },
  };
}

export function findNextAnnotatedAncestor(
  el: HTMLElement | null,
): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    if (node.getAttribute("data-k-loc")) return node;
    node = node.parentElement;
  }
  return null;
}
