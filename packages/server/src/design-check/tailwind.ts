// Tailwind utility class heuristics + theme parsing
// No dependencies

import { parseColor, checkContrast } from "./color.js";
import type { DesignFinding } from "./rules.js";

// ── Default Tailwind palette (v3/v4 common values) ───────────────────

const TAILWIND_COLORS: Record<string, Record<string, string>> = {
  slate: {
    "50": "#f8fafc", "100": "#f1f5f9", "200": "#e2e8f0", "300": "#cbd5e1",
    "400": "#94a3b8", "500": "#64748b", "600": "#475569", "700": "#334155",
    "800": "#1e293b", "900": "#0f172a", "950": "#020617",
  },
  gray: {
    "50": "#f9fafb", "100": "#f3f4f6", "200": "#e5e7eb", "300": "#d1d5db",
    "400": "#9ca3af", "500": "#6b7280", "600": "#4b5563", "700": "#374151",
    "800": "#1f2937", "900": "#111827", "950": "#030712",
  },
  zinc: {
    "50": "#fafafa", "100": "#f4f4f5", "200": "#e4e4e7", "300": "#d4d4d8",
    "400": "#a1a1aa", "500": "#71717a", "600": "#52525b", "700": "#3f3f46",
    "800": "#27272a", "900": "#18181b", "950": "#09090b",
  },
  neutral: {
    "50": "#fafafa", "100": "#f5f5f5", "200": "#e5e5e5", "300": "#d4d4d4",
    "400": "#a3a3a3", "500": "#737373", "600": "#525252", "700": "#404040",
    "800": "#262626", "900": "#171717", "950": "#0a0a0a",
  },
  stone: {
    "50": "#fafaf9", "100": "#f5f5f4", "200": "#e7e5e4", "300": "#d6d3d1",
    "400": "#a8a29e", "500": "#78716c", "600": "#57534e", "700": "#44403c",
    "800": "#292524", "900": "#1c1917", "950": "#0c0a09",
  },
  red: {
    "50": "#fef2f2", "100": "#fee2e2", "200": "#fecaca", "300": "#fca5a5",
    "400": "#f87171", "500": "#ef4444", "600": "#dc2626", "700": "#b91c1c",
    "800": "#991b1b", "900": "#7f1d1d", "950": "#450a0a",
  },
  orange: {
    "50": "#fff7ed", "100": "#ffedd5", "200": "#fed7aa", "300": "#fdba74",
    "400": "#fb923c", "500": "#f97316", "600": "#ea580c", "700": "#c2410c",
    "800": "#9a3412", "900": "#7c2d12", "950": "#431407",
  },
  amber: {
    "50": "#fffbeb", "100": "#fef3c7", "200": "#fde68a", "300": "#fcd34d",
    "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706", "700": "#b45309",
    "800": "#92400e", "900": "#78350f", "950": "#451a03",
  },
  yellow: {
    "50": "#fefce8", "100": "#fef9c3", "200": "#fef08a", "300": "#fde047",
    "400": "#facc15", "500": "#eab308", "600": "#ca8a04", "700": "#a16207",
    "800": "#854d0e", "900": "#713f12", "950": "#422006",
  },
  lime: {
    "50": "#f7fee7", "100": "#ecfccb", "200": "#d9f99d", "300": "#bef264",
    "400": "#a3e635", "500": "#84cc16", "600": "#65a30d", "700": "#4d7c0f",
    "800": "#3f6212", "900": "#365314", "950": "#1a2e05",
  },
  green: {
    "50": "#f0fdf4", "100": "#dcfce7", "200": "#bbf7d0", "300": "#86efac",
    "400": "#4ade80", "500": "#22c55e", "600": "#16a34a", "700": "#15803d",
    "800": "#166534", "900": "#14532d", "950": "#052e16",
  },
  emerald: {
    "50": "#ecfdf5", "100": "#d1fae5", "200": "#a7f3d0", "300": "#6ee7b7",
    "400": "#34d399", "500": "#10b981", "600": "#059669", "700": "#047857",
    "800": "#065f46", "900": "#064e3b", "950": "#022c22",
  },
  teal: {
    "50": "#f0fdfa", "100": "#ccfbf1", "200": "#99f6e4", "300": "#5eead4",
    "400": "#2dd4bf", "500": "#14b8a6", "600": "#0d9488", "700": "#0f766e",
    "800": "#115e59", "900": "#134e4a", "950": "#042f2e",
  },
  cyan: {
    "50": "#ecfeff", "100": "#cffafe", "200": "#a5f3fc", "300": "#67e8f9",
    "400": "#22d3ee", "500": "#06b6d4", "600": "#0891b2", "700": "#0e7490",
    "800": "#155e75", "900": "#164e63", "950": "#083344",
  },
  sky: {
    "50": "#f0f9ff", "100": "#e0f2fe", "200": "#bae6fd", "300": "#7dd3fc",
    "400": "#38bdf8", "500": "#0ea5e9", "600": "#0284c7", "700": "#0369a1",
    "800": "#075985", "900": "#0c4a6e", "950": "#082f49",
  },
  blue: {
    "50": "#eff6ff", "100": "#dbeafe", "200": "#bfdbfe", "300": "#93c5fd",
    "400": "#60a5fa", "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8",
    "800": "#1e40af", "900": "#1e3a8a", "950": "#172554",
  },
  indigo: {
    "50": "#eef2ff", "100": "#e0e7ff", "200": "#c7d2fe", "300": "#a5b4fc",
    "400": "#818cf8", "500": "#6366f1", "600": "#4f46e5", "700": "#4338ca",
    "800": "#3730a3", "900": "#312e81", "950": "#1e1b4b",
  },
  violet: {
    "50": "#f5f3ff", "100": "#ede9fe", "200": "#ddd6fe", "300": "#c4b5fd",
    "400": "#a78bfa", "500": "#8b5cf6", "600": "#7c3aed", "700": "#6d28d9",
    "800": "#5b21b6", "900": "#4c1d95", "950": "#2e1065",
  },
  purple: {
    "50": "#faf5ff", "100": "#f3e8ff", "200": "#e9d5ff", "300": "#d8b4fe",
    "400": "#c084fc", "500": "#a855f7", "600": "#9333ea", "700": "#7e22ce",
    "800": "#6b21a8", "900": "#581c87", "950": "#3b0764",
  },
  fuchsia: {
    "50": "#fdf4ff", "100": "#fae8ff", "200": "#f5d0fe", "300": "#f0abfc",
    "400": "#e879f9", "500": "#d946ef", "600": "#c026d3", "700": "#a21caf",
    "800": "#86198f", "900": "#701a75", "950": "#4a044e",
  },
  pink: {
    "50": "#fdf2f8", "100": "#fce7f3", "200": "#fbcfe8", "300": "#f9a8d4",
    "400": "#f472b6", "500": "#ec4899", "600": "#db2777", "700": "#be185d",
    "800": "#9d174d", "900": "#831843", "950": "#500724",
  },
  rose: {
    "50": "#fff1f2", "100": "#ffe4e6", "200": "#fecdd3", "300": "#fda4af",
    "400": "#fb7185", "500": "#f43f5e", "600": "#e11d48", "700": "#be123c",
    "800": "#9f1239", "900": "#881337", "950": "#4c0519",
  },
};

// ── Custom theme color resolution ────────────────────────────────────

let customThemeColors: Map<string, string> | null = null;

export function setCustomThemeColors(colors: Map<string, string>) {
  customThemeColors = colors;
}

export function clearCustomThemeColors() {
  customThemeColors = null;
}

const SPECIAL_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
  current: "currentColor",
};

function resolveTailwindColor(className: string): string | null {
  // Direct hex/rgb/etc in arbitrary value: text-[#ff0000]
  const arbitrary = className.match(/\[(#[0-9a-fA-F]{3,8}|[^\]]+)\]$/);
  if (arbitrary) {
    const raw = arbitrary[1];
    const parsed = parseColor(raw);
    if (parsed) return raw;
    return null;
  }

  // Special single-word colors: bg-white, text-black, border-transparent
  const specialMatch = className.match(/^(?:bg|text|border|ring|shadow|stroke|fill|from|via|to)-(white|black|transparent|current)$/);
  if (specialMatch) {
    return SPECIAL_COLORS[specialMatch[1]] ?? null;
  }

  // Standard scale: text-red-500, bg-slate-900, etc.
  const m = className.match(/^(?:bg|text|border|ring|shadow|stroke|fill|from|via|to)-(\w+)-(\d+)$/);
  if (!m) return null;
  const [, family, scale] = m;

  // Check custom theme first
  if (customThemeColors) {
    const key = `${family}-${scale}`;
    if (customThemeColors.has(key)) return customThemeColors.get(key)!;
    const varKey = `--color-${family}-${scale}`;
    if (customThemeColors.has(varKey)) return customThemeColors.get(varKey)!;
  }

  const palette = TAILWIND_COLORS[family.toLowerCase()];
  if (!palette) return null;
  return palette[scale] ?? null;
}

// ── Tailwind class extraction ────────────────────────────────────────

export function extractTailwindClasses(content: string): Array<{
  classes: string[];
  index: number;
  line: number;
  col: number;
}> {
  const out: Array<{ classes: string[]; index: number; line: number; col: number }> = [];

  // class="..." or class='...'
  const classRe = /class\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  m = classRe.exec(content);
  while (m !== null) {
    const raw = m[1];
    const classes = raw.split(/\s+/).filter(Boolean);
    const before = content.slice(0, m.index);
    const lines = before.split("\n");
    out.push({ classes, index: m.index, line: lines.length, col: lines[lines.length - 1].length + 1 });
    m = classRe.exec(content);
  }

  // JSX className="..."
  const classNameRe = /className\s*=\s*["']([^"']+)["']/gi;
  m = classNameRe.exec(content);
  while (m !== null) {
    const raw = m[1];
    const classes = raw.split(/\s+/).filter(Boolean);
    const before = content.slice(0, m.index);
    const lines = before.split("\n");
    out.push({ classes, index: m.index, line: lines.length, col: lines[lines.length - 1].length + 1 });
    m = classNameRe.exec(content);
  }

  // cn(...) helper calls
  const cnRe = /cn\s*\(\s*["']([^"']+)["']\s*\)/gi;
  m = cnRe.exec(content);
  while (m !== null) {
    const raw = m[1];
    const classes = raw.split(/\s+/).filter(Boolean);
    const before = content.slice(0, m.index);
    const lines = before.split("\n");
    out.push({ classes, index: m.index, line: lines.length, col: lines[lines.length - 1].length + 1 });
    m = cnRe.exec(content);
  }

  return out;
}

// ── Tailwind heuristic checks ────────────────────────────────────────

export function checkTailwindContrast(
  classes: string[],
  line: number,
  out: DesignFinding[],
) {
  const textClasses = classes.filter((c) => c.startsWith("text-"));
  const bgClasses = classes.filter(
    (c) => c.startsWith("bg-") || c.startsWith("from-") || c.startsWith("via-") || c.startsWith("to-"),
  );

  for (const tc of textClasses) {
    const textColor = resolveTailwindColor(tc);
    if (!textColor) continue;

    for (const bc of bgClasses) {
      const bgColor = resolveTailwindColor(bc);
      if (!bgColor) continue;

      const ratio = checkContrast(textColor, bgColor);
      if (ratio != null && ratio < 4.5) {
        out.push({
          rule: "low-contrast",
          severity: "error",
          message: `Low contrast Tailwind combo (${ratio.toFixed(2)}:1): ${tc} on ${bc}. WCAG AA requires 4.5:1 for body text.`,
          line,
          col: 1,
        });
      }
    }
  }
}

export function checkTailwindAiGradient(classes: string[], line: number, out: DesignFinding[]) {
  // bg-gradient-to-* with from-purple-* or from-violet-* or from-cyan-*
  const hasGradient = classes.some((c) => /^bg-gradient-to-/.test(c));
  if (!hasGradient) return;
  const hasAiColor = classes.some((c) => {
    const m = c.match(/^from-(purple|violet|cyan|fuchsia)-/);
    return !!m;
  });
  if (hasAiColor) {
    out.push({
      rule: "ai-gradient-palette",
      severity: "warning",
      message:
        "AI color palette detected: purple/violet/cyan Tailwind gradient. Choose a distinctive, intentional palette.",
      line,
      col: 1,
    });
  }
}

export function checkTailwindFontSize(classes: string[], line: number, out: DesignFinding[]) {
  for (const c of classes) {
    // text-xs = 12px, text-[10px] arbitrary
    if (c === "text-xs") {
      out.push({
        rule: "tiny-body-text",
        severity: "warning",
        message: "Tailwind text-xs (12px) is too small for body content. Use at least text-sm (14px), text-base (16px) is ideal.",
        line,
        col: 1,
      });
      return;
    }
    const arbitrary = c.match(/^text-\[(\d+(?:\.\d+)?)(px|rem|em)\]$/);
    if (arbitrary) {
      const val = parseFloat(arbitrary[1]);
      const unit = arbitrary[2];
      let px = val;
      if (unit === "rem" || unit === "em") px = val * 16;
      if (px < 14) {
        out.push({
          rule: "tiny-body-text",
          severity: "warning",
          message: `Tailwind arbitrary text size ${c} is too small. Use at least text-sm (14px) for body content.`,
          line,
          col: 1,
        });
      }
    }
  }
}

export function checkTailwindLineHeight(classes: string[], line: number, out: DesignFinding[]) {
  for (const c of classes) {
    // leading-3 = 0.75rem (12px for 16px base), leading-none = 1
    if (c === "leading-3" || c === "leading-none" || c === "leading-4") {
      out.push({
        rule: "tight-line-height",
        severity: "warning",
        message: `Tailwind ${c} is too tight for body text. Use leading-relaxed (1.625) or leading-loose (2) for readability.`,
        line,
        col: 1,
      });
      return;
    }
  }
}

export function checkTailwindPadding(classes: string[], line: number, out: DesignFinding[]) {
  for (const c of classes) {
    // p-0 = 0px, p-0.5 = 2px
    if (c === "p-0" || c === "px-0" || c === "py-0" || c === "pt-0" || c === "pr-0" || c === "pb-0" || c === "pl-0") {
      out.push({
        rule: "cramped-padding",
        severity: "info",
        message: "Tailwind zero padding is too cramped. Use at least p-2 (8px), ideally p-3 (12px) or p-4 (16px) inside containers.",
        line,
        col: 1,
      });
      return;
    }
    if (c === "p-0.5" || c === "px-0.5" || c === "py-0.5") {
      out.push({
        rule: "cramped-padding",
        severity: "info",
        message: "Tailwind 2px padding is too cramped. Use at least p-2 (8px) inside bordered or colored containers.",
        line,
        col: 1,
      });
      return;
    }
  }
}

export function checkTailwindEverythingCentered(
  classes: string[],
  line: number,
  out: DesignFinding[],
) {
  const textCenterCount = classes.filter((c) => c === "text-center").length;
  if (textCenterCount > 0) {
    // We count globally per file; the caller accumulates
  }
}

export function checkTailwindPureBlack(classes: string[], line: number, out: DesignFinding[]) {
  if (classes.includes("bg-black")) {
    out.push({
      rule: "pure-black-bg",
      severity: "info",
      message: "Tailwind bg-black is pure #000000 and looks harsh. Use bg-neutral-950 or bg-zinc-950 for a more refined dark background.",
      line,
      col: 1,
    });
  }
}

export function checkTailwindJustified(classes: string[], line: number, out: DesignFinding[]) {
  if (classes.includes("text-justify")) {
    out.push({
      rule: "justified-text",
      severity: "info",
      message: "Tailwind text-justify creates uneven word spacing ('rivers of white'). Use text-left for body text.",
      line,
      col: 1,
    });
  }
}

export function checkTailwindUppercase(classes: string[], line: number, out: DesignFinding[]) {
  if (classes.includes("uppercase")) {
    out.push({
      rule: "all-caps-body",
      severity: "warning",
      message: "Tailwind uppercase on body-like content is hard to read. Reserve uppercase for short labels and headings.",
      line,
      col: 1,
    });
  }
}

export function checkTailwindGradientText(classes: string[], line: number, out: DesignFinding[]) {
  if (classes.includes("bg-clip-text")) {
    out.push({
      rule: "gradient-text",
      severity: "warning",
      message: "Tailwind bg-clip-text (gradient text) kills scannability. Use solid text colors instead.",
      line,
      col: 1,
    });
  }
}

export function checkTailwindSideTab(classes: string[], line: number, out: DesignFinding[]) {
  // border-l-4 + border-*-500/600 pattern
  const hasThickBorder = classes.some((c) => /^border-[lrtb]-\d+$/.test(c) || /^border-[lrtb]-\[\d+px\]$/.test(c));
  const hasAccentColor = classes.some((c) =>
    /^(?:border|bg|text)-(red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+$/.test(c),
  );
  if (hasThickBorder && hasAccentColor) {
    out.push({
      rule: "side-tab-border",
      severity: "warning",
      message: "Thick colored border on one side is the most recognizable tell of AI-generated UIs. Use a subtler accent or remove it entirely.",
      line,
      col: 1,
    });
  }
}

export function checkTailwindMonotonousSpacing(
  classes: string[],
  line: number,
  out: DesignFinding[],
) {
  // Detect repeated use of the exact same spacing utility across the file
  // This is called per-class block; caller should aggregate
}

// ── Theme parser ─────────────────────────────────────────────────────

export function parseTailwindTheme(cssContent: string): Map<string, string> {
  const map = new Map<string, string>();

  // Tailwind v4 @theme inline { --color-red-500: #ef4444; }
  const themeRe = /@theme\s+(?:inline\s+)?\{([^}]*)\}/gi;
  let m: RegExpExecArray | null;
  m = themeRe.exec(cssContent);
  while (m !== null) {
    const body = m[1];
    // Match --color-*: value;
    const varRe = /(--[\w-]+)\s*:\s*([^;]+);?/gi;
    let vm: RegExpExecArray | null;
    vm = varRe.exec(body);
    while (vm !== null) {
      const varName = vm[1].trim();
      const value = vm[2].trim();
      map.set(varName, value);
      // Also set shorthand like red-500
      const short = varName.replace(/^--color-/, "");
      if (short !== varName) map.set(short, value);
      vm = varRe.exec(body);
    }
    m = themeRe.exec(cssContent);
  }

  return map;
}
