import type { FrameworkAdapter } from "@konstner/core";
import { createHtmlLikeAnnotator } from "./shared.js";

const CHANGE_PROMPT = `You are editing a Svelte 5 component. Preserve <script>/<style> blocks; modify only the requested element's attributes, classes, or children. Use runes when adding state.`;
const EXTRACT_PROMPT = `Extract the given subtree into a new Svelte 5 component under src/lib/components/. Use <script lang="ts"> with $props(). Replace the original subtree with an import + usage.`;

// Skip components (<Foo>) and svelte: namespaces (<svelte:head>) — we only
// annotate native HTML elements, which in Svelte always start lowercase.
const skipTag = (tagName: string) =>
  /^[A-Z]/.test(tagName) || tagName.includes(":");

export function createSvelteAdapter(): FrameworkAdapter {
  return {
    id: "svelte",
    matches: (id) => id.endsWith(".svelte"),
    annotate: createHtmlLikeAnnotator({ skipTag }),
    // TASK-5: replaced by applySveltePropertyEdit from @konstner/server.
    // Returning null means the server falls back to the prompt dispatch path.
    applyPropertyEdit: () => null,
    prompts: { change: CHANGE_PROMPT, extract: EXTRACT_PROMPT },
    componentExtension: ".svelte",
  };
}
