import { describe, it, expect } from "vitest";
import { createToastsStore } from "./toasts.svelte.js";

describe("toasts store", () => {
  it("push adds a toast with a unique id", () => {
    const s = createToastsStore();
    s.push("info", "hello");
    s.push("error", "bad");
    expect(s.items.length).toBe(2);
    expect(s.items[0].message).toBe("hello");
    expect(s.items[0].level).toBe("info");
    expect(s.items[1].level).toBe("error");
    expect(s.items[0].id).not.toBe(s.items[1].id);
  });

  it("dismiss removes a toast by id", () => {
    const s = createToastsStore();
    s.push("info", "a");
    s.push("info", "b");
    const firstId = s.items[0].id;
    s.dismiss(firstId);
    expect(s.items.length).toBe(1);
    expect(s.items[0].message).toBe("b");
  });
});
