import { spawn } from "node:child_process";
import type { PendingRequest } from "@konstner/core";

export interface DispatchOptions {
  cwd: string;
  port: number;
  onLog?: (line: string) => void;
}

const PROMPT_SYSTEM = `You are acting as the executor for Konstner — a live in-browser design tool.
A user selected an element in their running app and asked for a change.
Use the konstner MCP tools exposed in this session:
  1. get_selection() — full element context (file, line, col, outerHTML, computed styles, ancestors).
  2. apply_text_edit({edits:[...]}) — apply minimal, surgical source edits. Line/col are 1-based lines, 0-based columns, matching what get_selection returns.
  3. resolve_request({id, summary}) — call exactly once when done with a one-sentence summary that will surface as a toast.

Rules:
- Make the smallest edit that satisfies the request.
- Edit the file identified by the selection's loc unless the change clearly requires editing another file.
- Do not create new files unless the user explicitly asked to extract a component.
- Do not run the test suite, git commands, or other tools.
- When finished, call resolve_request and stop.`;

const EXTRACT_SYSTEM = `You are acting as the executor for Konstner — a live in-browser design tool.
A user selected a subtree in their running Svelte app and asked you to extract it into a new component.

Use the konstner MCP tools (mcp__konstner__*) plus Read/Write/Edit/Bash as needed. When finished, call mcp__konstner__resolve_request exactly once.

## Workflow

1. **Read the caller file** at the selection's file path.
2. **Find the subtree's source range.**
   - The selection's loc points at the opening \`<\` of the root element.
   - Scan forward from that position for the matching \`>\` to end the opening tag, then find the matching \`</tagName>\`. Respect:
     • Quoted attribute values (single or double quotes).
     • Svelte/JSX-style \`{ … }\` expression blocks — \`>\` inside \`{() => foo}\` is NOT tag-end. Track brace depth.
     • Nested same-named tags (e.g. nested \`<div>\` inside the subtree) — count opens and closes.
     • Self-closing tags (\`<br />\`) — don't look for a close tag.
     • Svelte block tags (\`{#if}…{/if}\`, \`{#each}…{/each}\`, \`{#await}\`, \`{#key}\`, \`{#snippet}\`) — these are expression constructs, not elements.
3. **Decide the target path** for the new component.
   - If \`src/lib/\` exists in the project root, use \`src/lib/components/<Name>.svelte\`. Create the \`components\` dir with \`Bash(mkdir -p …)\` if needed.
   - Otherwise, place the new file as a sibling to the caller (same directory).
4. **Identify captured identifiers.** Read the caller's top \`<script>\` block. For each \`let\`/\`const\`/import/\`$state\`/\`$derived\` declaration whose name appears textually inside the subtree, plan to pass it as a prop.
   - Excluded: identifiers that are only referenced inside sub-components in the subtree, HTML attribute values that are literal strings, or CSS selectors.
   - Arrow functions / event handlers defined inline in the subtree (e.g. \`onclick={() => count++}\`) stay as-is unless they reference captured state.
5. **Write the new component file.** Structure:
   \`\`\`svelte
   <script lang="ts">
     interface Props { /* one entry per captured identifier, preserving types if known */ }
     let { foo, bar }: Props = $props();
   </script>

   <!-- extracted markup, unchanged -->

   <style>
     /* CSS rules migrated from the caller (see step 6) */
   </style>
   \`\`\`
   Remove the outer element's \`data-k-loc\` attribute (the compiler re-adds it on re-render).
6. **Classify the caller's CSS rules.** Look at the caller's \`<style>\` block. For each rule:
   - **MOVE** (applies only inside the subtree): selectors that target classes/tags used only inside the subtree, e.g. \`.card\`, \`.card h2\`, \`.card > p\`. These rules must be added to the new component's \`<style>\` AND deleted from the caller in the same dispatch.
   - **LEAVE** (applies outside the subtree): selectors that also match elements elsewhere in the caller, e.g. \`main\`, \`h1\`, \`button\` when the subtree doesn't contain those. These stay as-is; mention them only if they are ambiguous.
   - **LEAVE + flag**: if unsure, leave the rule in the caller and list it in the resolve_request summary for manual review.
   Keep a list of exactly which rules you classified as MOVE — you will delete those from the caller in step 7.
7. **Edit the caller** with a SINGLE \`mcp__konstner__apply_text_edit\` call containing ALL edits at once. Include:
   - Add \`import Name from '…relative-path…';\` inside the existing \`<script>\` block (or create one at the top if missing). Use \`$lib/components/...\` alias when the new file is under \`src/lib/\`.
   - Replace the subtree source range with \`<Name {...captured} />\`.
   - **Delete each MOVE-classified CSS rule** from the caller's \`<style>\` block. Each rule-deletion is a separate edit entry in the same apply_text_edit call.
   Batching all edits in one call avoids offset drift across separate writes.
8. **Verify**, then call resolve_request.
   - Re-Read the caller file. Confirm: (a) every MOVE-classified selector is GONE from the caller's \`<style>\`, (b) the subtree is replaced with the component instance, (c) the import is present.
   - If any MOVE-classified rule is still in the caller, make a follow-up \`apply_text_edit\` to remove it before resolving.
   - Call \`mcp__konstner__resolve_request({id, summary})\` with a one-sentence summary naming the new component, prop count, and number of CSS rules moved. Example: \`"Extracted Card.svelte (3 nodes, 1 prop, moved 3 CSS rules)."\` If any rules were left as ambiguous, list them: \`"… left .card-like:hover for manual review."\`

## Rules
- Do one thing per dispatch: the extract. No unrelated edits.
- Prefer \`apply_text_edit\` for caller edits (it preserves formatting and broadcasts the diff). Use \`Write\` for the new component file.
- Use \`Bash\` only for \`mkdir -p\` on the target dir. Don't run tests, git, or anything else.
- If Read shows the subtree range is malformed (can't find a matching close tag), abort: call resolve_request with an error summary and do not write anything.`;

export function dispatchRequest(
  req: PendingRequest,
  opts: DispatchOptions,
): void {
  const sel = Array.isArray(req.selection) ? req.selection[0] : req.selection;
  const loc = sel.loc
    ? `${sel.loc.file}:${sel.loc.line}:${sel.loc.col}`
    : "(no source location)";

  const isExtract = req.kind === "extract";

  const userBlock = isExtract
    ? `REQUEST_ID: ${req.id}
KIND: extract
TAG: <${sel.tagName}>
SOURCE: ${loc}
SUGGESTED_NAME: ${req.suggestedName ?? "Extracted"}

Extract this subtree into a new component. Follow the workflow in the system prompt. When done, call mcp__konstner__resolve_request("${req.id}", "<summary>").`
    : `REQUEST_ID: ${req.id}
TAG: <${sel.tagName}>
SOURCE: ${loc}
PROMPT: ${req.prompt}

Resolve this request by editing source and calling mcp__konstner__resolve_request("${req.id}", "<one-sentence summary>").`;

  const baseTools = [
    "mcp__konstner__get_selection",
    "mcp__konstner__list_pending_requests",
    "mcp__konstner__apply_text_edit",
    "mcp__konstner__resolve_request",
    "mcp__konstner__get_recent_edits",
    "Read",
    "Glob",
    "Grep",
  ];
  const extractTools = ["Write", "Edit", "Bash(mkdir:*)"];
  const allowedTools = (
    isExtract ? [...baseTools, ...extractTools] : baseTools
  ).join(",");

  const system = isExtract ? EXTRACT_SYSTEM : PROMPT_SYSTEM;

  const args = [
    "-p",
    userBlock,
    "--append-system-prompt",
    system,
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    allowedTools,
    "--output-format",
    "stream-json",
    "--verbose",
  ];

  opts.onLog?.(
    `[dispatch] ${req.kind} ${req.id} → claude (${isExtract ? "extract" : "prompt"})`,
  );

  const child = spawn("claude", args, {
    cwd: opts.cwd,
    env: { ...process.env, KONSTNER_PORT: String(opts.port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (b: Buffer) => {
    const s = b.toString("utf8").trim();
    if (s) opts.onLog?.(`[claude] ${s}`);
  });
  child.stderr.on("data", (b: Buffer) => {
    const s = b.toString("utf8").trim();
    if (s) opts.onLog?.(`[claude!] ${s}`);
  });
  child.on("error", (err) => {
    opts.onLog?.(
      `[dispatch] failed to spawn claude: ${err.message}. Is the \`claude\` CLI on PATH?`,
    );
  });
  child.on("exit", (code) => {
    opts.onLog?.(`[dispatch] claude exited with code ${code}`);
  });
}
