import { readFile } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import {
  lint,
  brokenRef,
  missingPrimary,
  contrastCheck,
  orphanedTokens,
  tokenSummary,
  missingSections,
  missingTypography,
} from "@google/design.md/linter";
import type {
  DesignSystemState,
  ResolvedColor,
  ResolvedDimension,
  ResolvedTypography,
  ComponentDef,
  ResolvedValue,
} from "@google/design.md/linter";

interface RuleEntry {
  name: string;
  defaultSeverity: "error" | "warning" | "info";
  run: (state: DesignSystemState) => Array<{
    path?: string;
    message: string;
    severity?: "error" | "warning" | "info";
  }>;
}

const RULES: RuleEntry[] = [
  { name: "broken-ref", defaultSeverity: "error", run: brokenRef },
  { name: "missing-primary", defaultSeverity: "warning", run: missingPrimary },
  { name: "contrast-ratio", defaultSeverity: "warning", run: contrastCheck },
  { name: "orphaned-tokens", defaultSeverity: "warning", run: orphanedTokens },
  { name: "token-summary", defaultSeverity: "info", run: tokenSummary },
  { name: "missing-sections", defaultSeverity: "info", run: missingSections },
  { name: "missing-typography", defaultSeverity: "warning", run: missingTypography },
];

export interface DesignSystemTypography {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number;
  lineHeight?: string;
  letterSpacing?: string;
}

export interface DesignFindingLite {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  path?: string;
}

export interface DesignSystem {
  name: string;
  description?: string;
  colors: Record<string, string>;
  typography: Record<string, DesignSystemTypography>;
  rounded: Record<string, string>;
  spacing: Record<string, string>;
  components: Record<string, Record<string, string>>;
  findings: DesignFindingLite[];
  raw: string;
  sourcePath: string;
}

function formatDimension(d: ResolvedDimension): string {
  return `${d.value}${d.unit}`;
}

function colorsToRecord(m: Map<string, ResolvedColor>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of m) out[k] = v.hex;
  return out;
}

function dimsToRecord(m: Map<string, ResolvedDimension>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of m) out[k] = formatDimension(v);
  return out;
}

function typographyToRecord(
  m: Map<string, ResolvedTypography>,
): Record<string, DesignSystemTypography> {
  const out: Record<string, DesignSystemTypography> = {};
  for (const [k, v] of m) {
    const entry: DesignSystemTypography = {};
    if (v.fontFamily) entry.fontFamily = v.fontFamily;
    if (v.fontSize) entry.fontSize = formatDimension(v.fontSize);
    if (v.fontWeight != null) entry.fontWeight = v.fontWeight;
    if (v.lineHeight) entry.lineHeight = formatDimension(v.lineHeight);
    if (v.letterSpacing) entry.letterSpacing = formatDimension(v.letterSpacing);
    out[k] = entry;
  }
  return out;
}

function valueToString(v: ResolvedValue): string {
  if (typeof v === "string") return v;
  if (v.type === "color") return v.hex;
  if (v.type === "dimension") return formatDimension(v);
  if (v.type === "typography") {
    const parts: string[] = [];
    if (v.fontFamily) parts.push(v.fontFamily);
    if (v.fontSize) parts.push(formatDimension(v.fontSize));
    return parts.join(" ");
  }
  return "";
}

function componentsToRecord(
  m: Map<string, ComponentDef>,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [name, def] of m) {
    const props: Record<string, string> = {};
    for (const [k, v] of def.properties) props[k] = valueToString(v);
    out[name] = props;
  }
  return out;
}

function runTaggedRules(state: DesignSystemState): DesignFindingLite[] {
  const out: DesignFindingLite[] = [];
  for (const desc of RULES) {
    let findings;
    try {
      findings = desc.run(state);
    } catch {
      continue;
    }
    for (const f of findings) {
      out.push({
        rule: desc.name,
        severity: f.severity ?? desc.defaultSeverity,
        message: f.message,
        path: f.path,
      });
    }
  }
  return out;
}

export async function loadDesignSystem(
  projectRoot: string,
): Promise<DesignSystem | null> {
  const sourcePath = join(projectRoot, "DESIGN.md");
  let raw: string;
  try {
    raw = await readFile(sourcePath, "utf8");
  } catch {
    return null;
  }
  const report = lint(raw);
  const state = report.designSystem;
  return {
    name: state.name ?? "unnamed",
    description: state.description,
    colors: colorsToRecord(state.colors),
    typography: typographyToRecord(state.typography),
    rounded: dimsToRecord(state.rounded),
    spacing: dimsToRecord(state.spacing),
    components: componentsToRecord(state.components),
    findings: runTaggedRules(state),
    raw,
    sourcePath,
  };
}

export function watchDesignSystem(
  projectRoot: string,
  onChange: (ds: DesignSystem | null) => void,
): () => void {
  const sourcePath = join(projectRoot, "DESIGN.md");
  let timer: NodeJS.Timeout | null = null;
  let watcher: FSWatcher | null = null;
  try {
    watcher = watch(sourcePath, { persistent: false }, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void loadDesignSystem(projectRoot).then(onChange).catch(() => {});
      }, 100);
    });
  } catch {
    // DESIGN.md absent — caller may opt to create it later, but we don't watch yet.
  }
  return () => {
    if (timer) clearTimeout(timer);
    watcher?.close();
  };
}

export function prose(ds: DesignSystem): string {
  const m = /^---\n[\s\S]*?\n---\n?/.exec(ds.raw);
  return m ? ds.raw.slice(m[0].length) : ds.raw;
}
