import MagicString from "magic-string";
import type { FrameworkAdapter, AnnotateResult, AnnotateContext } from "@konstner/core";
import { TAG_RE, buildLineOffsets, findBlockedRanges, isInRanges, toLineCol } from "./shared.js";

const SKIP = new Set(["html", "head", "body", "title", "meta", "link", "base"]);

const CHANGE_PROMPT = `You are editing a plain HTML file. Preserve doctype and head. Modify only the requested element's attributes, classes, or children.`;
const EXTRACT_PROMPT = `Extract the given subtree into a new .html partial under ./partials/. Replace the original subtree with an HTML comment referencing the partial path.`;

export function createPlainHtmlAdapter(): FrameworkAdapter {
  return {
    id: "plain-html",
    matches: (id) => id.endsWith(".html"),
    annotate,
    // Plain HTML edits go through the prompt path; no direct rewrite.
    applyPropertyEdit: () => null,
    prompts: { change: CHANGE_PROMPT, extract: EXTRACT_PROMPT },
    componentExtension: ".html",
  };
}

function annotate(code: string, ctx: AnnotateContext): AnnotateResult | null {
  const ms = new MagicString(code);
  let touched = false;
  const offsets = buildLineOffsets(code);
  const blocked = findBlockedRanges(code);
  for (const match of code.matchAll(TAG_RE)) {
    const start = match.index ?? 0;
    if (isInRanges(start, blocked)) continue;
    const tagName = match[1];
    if (SKIP.has(tagName)) continue;
    const attrs = match[2] ?? "";
    if (attrs.includes("data-k-loc=")) continue;
    const { line, col } = toLineCol(offsets, start);
    ms.appendLeft(start + 1 + tagName.length, ` data-k-loc="${ctx.filename}:${line}:${col}"`);
    touched = true;
  }
  if (!touched) return null;
  return { code: ms.toString(), map: ms.generateMap({ hires: true, source: ctx.filename }) };
}
