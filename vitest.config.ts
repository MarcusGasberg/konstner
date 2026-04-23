import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: "node",
    include: ["packages/*/src/**/*.test.ts"],
    environmentMatchGlobs: [["packages/client/src/**", "happy-dom"]],
    setupFiles: ["./packages/client/test-setup.ts"],
  },
});
