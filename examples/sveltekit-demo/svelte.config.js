import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() },
  vitePlugin: {
    dynamicCompileOptions({ filename }) {
      // Konstner's in-page UI mounts into a shadow root; its component
      // styles must be inlined into the JS so they attach at mount time
      // instead of being emitted as external CSS for document.head.
      if (filename.includes("/packages/client/src/ui/")) {
        return { css: "injected" };
      }
    },
  },
};
