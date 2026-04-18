import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import konstner from "@konstner/vite-plugin";

export default defineConfig({
  plugins: [konstner(), tailwindcss(), sveltekit()],
  ssr: {
    noExternal: [/^@konstner\//],
  },
  server: {
    fs: { allow: ["..", "../.."] },
  },
  optimizeDeps: {
    exclude: ["@konstner/client", "@konstner/core"],
  },
});
