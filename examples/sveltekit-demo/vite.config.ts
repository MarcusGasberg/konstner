import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import konstner, { createOpenCodeProvider } from "@konstner/vite-plugin";

export default defineConfig({
  plugins: [
    konstner({
      provider: createOpenCodeProvider(),
    }),
    tailwindcss(),
    sveltekit(),
  ],
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
