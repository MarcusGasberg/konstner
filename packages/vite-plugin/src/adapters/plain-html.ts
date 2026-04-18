import type { FrameworkAdapter } from "@konstner/core";
import { createHtmlLikeAnnotator } from "./shared.js";

const SKIP = new Set([
  "html",
  "head",
  "body",
  "title",
  "meta",
  "link",
  "base",
]);

const CHANGE_PROMPT = `You are editing a plain HTML file. Preserve doctype and head. Modify only the requested element's attributes, classes, or children.`;
const EXTRACT_PROMPT = `Extract the given subtree into a new .html partial under ./partials/. Replace the original subtree with an HTML comment referencing the partial path.`;

export function createPlainHtmlAdapter(): FrameworkAdapter {
  return {
    id: "plain-html",
    matches: (id) => id.endsWith(".html"),
    annotate: createHtmlLikeAnnotator({ skipTag: (t) => SKIP.has(t) }),
    // Plain HTML edits go through the prompt path; no direct rewrite.
    applyPropertyEdit: () => null,
    prompts: { change: CHANGE_PROMPT, extract: EXTRACT_PROMPT },
    componentExtension: ".html",
  };
}
