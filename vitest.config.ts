import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/*/src/**/*.test.ts"],
    environmentMatchGlobs: [
      ["packages/client/src/**", "happy-dom"],
    ],
  },
});
