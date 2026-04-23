export interface HoverStore {
  readonly target: HTMLElement | null;
  set(el: HTMLElement | null): void;
}

export function createHoverStore(): HoverStore {
  let target = $state<HTMLElement | null>(null);
  return {
    get target() {
      return target;
    },
    set(el) {
      target = el;
    },
  };
}
