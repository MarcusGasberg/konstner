export interface PanelStore {
  readonly open: boolean;
  readonly extractOpen: boolean;
  toggle(): void;
  setOpen(v: boolean): void;
  openExtract(): void;
  closeExtract(): void;
}

export function createPanelStore(): PanelStore {
  let open = $state(false);
  let extractOpen = $state(false);
  return {
    get open() {
      return open;
    },
    get extractOpen() {
      return extractOpen;
    },
    toggle() {
      open = !open;
      if (!open) extractOpen = false;
    },
    setOpen(v) {
      open = v;
      if (!open) extractOpen = false;
    },
    openExtract() {
      extractOpen = true;
    },
    closeExtract() {
      extractOpen = false;
    },
  };
}
