export interface HoverStore {
  readonly target: HTMLElement | null;
  readonly active: boolean;
  set(el: HTMLElement | null): void;
  setActive(v: boolean): void;
}

export function createHoverStore(): HoverStore {
  let target = $state<HTMLElement | null>(null);
  let active = $state(false);
  return {
    get target() {
      return target;
    },
    get active() {
      return active;
    },
    set(el) {
      target = el;
    },
    setActive(v) {
      active = v;
    },
  };
}
