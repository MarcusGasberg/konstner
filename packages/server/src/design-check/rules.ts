import { parseColor, checkContrast } from "./color.js";
import type { DesignSystem } from "../designmd/index.js";
import {
  extractTailwindClasses,
  checkTailwindContrast,
  checkTailwindAiGradient,
  checkTailwindFontSize,
  checkTailwindLineHeight,
  checkTailwindPadding,
  checkTailwindPureBlack,
  checkTailwindJustified,
  checkTailwindUppercase,
  checkTailwindGradientText,
  checkTailwindSideTab,
  parseTailwindTheme,
} from "./tailwind.js";

export interface DesignFinding {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  col?: number;
}

export interface RuleContext {
  filePath: string;
  content: string;
  ext: string;
  isCss: boolean;
  isHtmlLike: boolean;
  isJsxLike: boolean;
  designSystem?: DesignSystem | null;
}

export type DesignRule = (ctx: RuleContext, out: DesignFinding[]) => void;

const RULES: DesignRule[] = [];

export function registerRule(rule: DesignRule): void {
  RULES.push(rule);
}

export function clearRules(): void {
  RULES.length = 0;
}

export function getRules(): readonly DesignRule[] {
  return RULES;
}

function lineCol(content: string, index: number): { line: number; col: number } {
  const before = content.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

function pushFinding(
  out: DesignFinding[],
  rule: string,
  severity: DesignFinding["severity"],
  message: string,
  content: string,
  index: number,
) {
  const { line, col } = lineCol(content, index);
  out.push({ rule, severity, message, line, col });
}

// ── Built-in raw-text rules ──────────────────────────────────────────

function ruleAiGradients(ctx: RuleContext, out: DesignFinding[]) {
  const re =
    /(?:background|background-image)\s*:\s*(?:linear|radial|conic)-gradient\s*\([^)]*\)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const grad = m[0].toLowerCase();
    const hasPurple =
      /purple|violet|#(?:8a2be2|9932cc|9400d3|ba55d3|da70d6|dda0dd|ee82ee|f0f|f0f8ff|e6e6fa|d8bfd8)/.test(grad);
    const hasCyan =
      /cyan|teal|#(?:00ffff|0ff|20b2aa|008b8b|00ced1|48d1cc|40e0d0|00fa9a)/.test(grad);
    if (hasPurple || hasCyan) {
      pushFinding(
        out,
        "ai-gradient-palette",
        "warning",
        "AI color palette detected: purple/violet/cyan gradient. Choose a distinctive, intentional palette.",
        ctx.content,
        m.index,
      );
    }
    m = re.exec(ctx.content);
  }
}

function ruleGradientText(ctx: RuleContext, out: DesignFinding[]) {
  const re = /-webkit-background-clip\s*:\s*text|bg-clip-text/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    pushFinding(
      out,
      "gradient-text",
      "warning",
      "Gradient text kills scannability. Use solid colors for text.",
      ctx.content,
      m.index,
    );
    m = re.exec(ctx.content);
  }
}

function ruleOverusedFonts(ctx: RuleContext, out: DesignFinding[]) {
  const re = /font-family\s*:\s*([^;]+)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const val = m[1].toLowerCase();
    const overused = ["inter", "roboto", "open sans", "lato", "montserrat", "arial"];
    for (const font of overused) {
      if (val.includes(font)) {
        pushFinding(
          out,
          "overused-font",
          "info",
          `Overused font detected: "${font}". Choose a distinctive font that gives your interface personality.`,
          ctx.content,
          m.index,
        );
        break;
      }
    }
    m = re.exec(ctx.content);
  }
}

function ruleAllCapsBody(ctx: RuleContext, out: DesignFinding[]) {
  const re = /text-transform\s*:\s*uppercase/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const before = ctx.content.slice(0, m.index);
    const selectorMatch = before.match(/([^{]+)\{[^}]*$/);
    const selector = selectorMatch ? selectorMatch[1].trim().toLowerCase() : "";
    const isBodyLike =
      /body|p\b|span\b|div\b|article|section|main/.test(selector) &&
      !/h[1-6]|button|label|badge|tag/.test(selector);
    if (isBodyLike) {
      pushFinding(
        out,
        "all-caps-body",
        "warning",
        "All-caps body text is hard to read. Reserve uppercase for short labels and headings.",
        ctx.content,
        m.index,
      );
    }
    m = re.exec(ctx.content);
  }
}

function ruleEverythingCentered(ctx: RuleContext, out: DesignFinding[]) {
  const re = /text-align\s*:\s*center/gi;
  let count = 0;
  let m = re.exec(ctx.content);
  while (m !== null) {
    count++;
    m = re.exec(ctx.content);
  }
  if (count >= 3) {
    let idx = 0;
    let found = 0;
    while (found < 3) {
      const next = ctx.content.indexOf("text-align", idx);
      if (next === -1) break;
      idx = next + 1;
      found++;
    }
    pushFinding(
      out,
      "everything-centered",
      "warning",
      "Everything is center-aligned. Left-align text with asymmetric layouts feels more designed. Center only hero sections and CTAs.",
      ctx.content,
      idx - 1,
    );
  }
}

function ruleNestedCards(ctx: RuleContext, out: DesignFinding[]) {
  const cardNames = /\bcard\b|\.card|\.panel|\.tile|\.box/;
  if (!cardNames.test(ctx.content)) return;
  const blocks: Array<{ selector: string; start: number; end: number }> = [];
  const ruleRe = /([^{]+)\{([^}]*)\}/g;
  let rm = ruleRe.exec(ctx.content);
  while (rm !== null) {
    const selector = rm[1].trim();
    if (cardNames.test(selector)) {
      blocks.push({ selector, start: rm.index, end: rm.index + rm[0].length });
    }
    rm = ruleRe.exec(ctx.content);
  }
  for (let i = 0; i < blocks.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i === j) continue;
      const outer = blocks[j].selector.toLowerCase();
      const inner = blocks[i].selector.toLowerCase();
      if (
        outer.includes(" ") &&
        outer.includes(inner.split(/[.\s>+~]/).pop() || "")
      ) {
        pushFinding(
          out,
          "nested-cards",
          "warning",
          "Nested cards create visual noise and excessive depth. Flatten the hierarchy — use spacing, typography, and dividers instead.",
          ctx.content,
          blocks[i].start,
        );
        break;
      }
    }
  }
}

function ruleSideTabBorder(ctx: RuleContext, out: DesignFinding[]) {
  const re = /border-(?:left|right)\s*:\s*(?:\d+px|thick)\s+(?:solid|none)?\s*([^;]+)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const color = m[1].trim();
    if (color && color !== "transparent" && !color.startsWith("0")) {
      pushFinding(
        out,
        "side-tab-border",
        "warning",
        "Side-tab accent border is the most recognizable tell of AI-generated UIs. Use a subtler accent or remove it entirely.",
        ctx.content,
        m.index,
      );
    }
    m = re.exec(ctx.content);
  }
}

function ruleBounceEasing(ctx: RuleContext, out: DesignFinding[]) {
  const re = /cubic-bezier\s*\([^)]*\)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const val = m[0];
    const nums = val.match(/-?[\d.]+/g)?.map(Number) ?? [];
    if (nums.length >= 4) {
      const [, , y1, y2] = nums;
      if (y1 > 1.05 || y2 > 1.05 || y1 < -0.05 || y2 < -0.05) {
        pushFinding(
          out,
          "bounce-easing",
          "warning",
          "Bounce or elastic easing feels dated. Use exponential easing (ease-out-quart/quint/expo) instead.",
          ctx.content,
          m.index,
        );
      }
    }
    m = re.exec(ctx.content);
  }
}

function ruleLayoutAnimation(ctx: RuleContext, out: DesignFinding[]) {
  const re = /transition\s*:\s*([^;]+)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const val = m[1].toLowerCase();
    if (/\b(width|height|padding|margin|top|left|right|bottom)\b/.test(val)) {
      pushFinding(
        out,
        "layout-animation",
        "warning",
        "Animating width, height, padding, or margin causes layout thrash. Use transform and opacity instead.",
        ctx.content,
        m.index,
      );
    }
    m = re.exec(ctx.content);
  }
}

function rulePureBlackBg(ctx: RuleContext, out: DesignFinding[]) {
  const re = /background(?:-color)?\s*:\s*(#000000|#000|rgb\s*\(\s*0\s*,\s*0\s*,\s*0\s*\)|black\b)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    pushFinding(
      out,
      "pure-black-bg",
      "info",
      "Pure #000000 as a background looks harsh and unnatural. Tint it slightly toward your brand hue for a more refined feel.",
      ctx.content,
      m.index,
    );
    m = re.exec(ctx.content);
  }
}

function ruleSkippedHeadings(ctx: RuleContext, out: DesignFinding[]) {
  const tags: Array<{ tag: number; index: number }> = [];
  const re = /<h([1-6])\b/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    tags.push({ tag: Number(m[1]), index: m.index });
    m = re.exec(ctx.content);
  }
  for (let i = 1; i < tags.length; i++) {
    const prev = tags[i - 1].tag;
    const curr = tags[i].tag;
    if (curr > prev + 1) {
      pushFinding(
        out,
        "skipped-heading",
        "warning",
        `Skipped heading level: h${prev} → h${curr}. Heading levels should not skip.`,
        ctx.content,
        tags[i].index,
      );
    }
  }
}

function ruleTinyBodyText(ctx: RuleContext, out: DesignFinding[]) {
  const re = /font-size\s*:\s*([\d.]+)\s*(px|rem|em)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const val = parseFloat(m[1]);
    const unit = m[2];
    let px = val;
    if (unit === "rem" || unit === "em") px = val * 16;
    if (px < 14) {
      pushFinding(
        out,
        "tiny-body-text",
        "warning",
        `Body text at ${m[1]}${unit} is too small. Use at least 14px for body content, 16px is ideal.`,
        ctx.content,
        m.index,
      );
    }
    m = re.exec(ctx.content);
  }
}

function ruleTightLineHeight(ctx: RuleContext, out: DesignFinding[]) {
  const re = /line-height\s*:\s*([\d.]+)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const val = parseFloat(m[1]);
    if (val < 1.3 && val > 0.5) {
      pushFinding(
        out,
        "tight-line-height",
        "warning",
        `Line height of ${val} is too tight. Use 1.5 to 1.7 for body text so lines have room to breathe.`,
        ctx.content,
        m.index,
      );
    }
    m = re.exec(ctx.content);
  }
}

function ruleWideLetterSpacing(ctx: RuleContext, out: DesignFinding[]) {
  const re = /letter-spacing\s*:\s*([\d.]+)\s*(em|rem|px)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const val = parseFloat(m[1]);
    const unit = m[2];
    let em = val;
    if (unit === "px") em = val / 16;
    if (em > 0.05) {
      const before = ctx.content.slice(0, m.index);
      const selectorMatch = before.match(/([^{]+)\{[^}]*$/);
      const selector = selectorMatch ? selectorMatch[1].trim().toLowerCase() : "";
      const isBodyLike = /body|p\b|article|section|main|div/.test(selector);
      if (isBodyLike) {
        pushFinding(
          out,
          "wide-letter-spacing",
          "info",
          `Wide letter spacing (${m[1]}${unit}) on body text disrupts reading. Reserve wide tracking for short uppercase labels only.`,
          ctx.content,
          m.index,
        );
      }
    }
    m = re.exec(ctx.content);
  }
}

function ruleJustifiedText(ctx: RuleContext, out: DesignFinding[]) {
  const re = /text-align\s*:\s*justify/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    pushFinding(
      out,
      "justified-text",
      "info",
      "Justified text without hyphenation creates uneven word spacing ('rivers of white'). Use text-align: left for body text.",
      ctx.content,
      m.index,
    );
    m = re.exec(ctx.content);
  }
}

function ruleCrampedPadding(ctx: RuleContext, out: DesignFinding[]) {
  const re = /padding\s*:\s*([\d.]+)\s*(px|rem|em)/gi;
  let m = re.exec(ctx.content);
  while (m !== null) {
    const val = parseFloat(m[1]);
    const unit = m[2];
    let px = val;
    if (unit === "rem" || unit === "em") px = val * 16;
    if (px < 8) {
      pushFinding(
        out,
        "cramped-padding",
        "info",
        `Padding of ${m[1]}${unit} is too cramped. Add at least 8px (ideally 12-16px) inside bordered or colored containers.`,
        ctx.content,
        m.index,
      );
    }
    m = re.exec(ctx.content);
  }
}

// ── CSS-aware contrast checking ──────────────────────────────────────

interface CssDecl {
  property: string;
  value: string;
  line: number;
  col: number;
}

interface CssRule {
  selector: string;
  declarations: CssDecl[];
  startLine: number;
}

function parseCssRules(cssText: string, baseLine = 1): CssRule[] {
  const rules: CssRule[] = [];
  let depth = 0;
  let ruleStart = 0;
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < cssText.length; i++) {
    const ch = cssText[i];
    if (inString) {
      if (ch === "\\") {
        i++;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "{") {
      depth++;
      continue;
    }
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        const block = cssText.slice(ruleStart, i + 1);
        const openIdx = block.indexOf("{");
        if (openIdx > 0) {
          const selector = block.slice(0, openIdx).trim();
          const body = block.slice(openIdx + 1, -1);
          const declarations: CssDecl[] = [];
          const declParts = body.split(";");
          let lineOffset = 0;
          for (const part of declParts) {
            const colonIdx = part.indexOf(":");
            if (colonIdx > 0) {
              const prop = part.slice(0, colonIdx).trim();
              const val = part.slice(colonIdx + 1).trim();
              const beforeDecl = body.slice(0, body.indexOf(part));
              const lines = beforeDecl.split("\n");
              declarations.push({
                property: prop,
                value: val,
                line: baseLine + lineOffset + lines.length - 1,
                col: 1,
              });
            }
            lineOffset += part.split("\n").length - 1;
          }
          rules.push({ selector, declarations, startLine: baseLine });
        }
        ruleStart = i + 1;
      }
      continue;
    }
  }
  return rules;
}

function checkLowContrastCss(rules: CssRule[], out: DesignFinding[]) {
  for (const rule of rules) {
    let textColor: string | null = null;
    let bgColor: string | null = null;
    let textDecl: CssDecl | null = null;

    for (const decl of rule.declarations) {
      const prop = decl.property.toLowerCase();
      if (prop === "color") {
        textColor = decl.value;
        textDecl = decl;
      } else if (prop === "background-color") {
        bgColor = decl.value;
      } else if (prop === "background") {
        const val = decl.value.toLowerCase();
        if (!/url\(|gradient\(/.test(val)) {
          const colorMatch = val.match(
            /(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|lch\([^)]+\)|lab\([^)]+\)|\b(?:black|white|red|green|blue|gray|grey|orange|purple|cyan|magenta|yellow|pink|brown|navy|teal|lime|indigo|transparent)\b)/,
          );
          if (colorMatch) bgColor = colorMatch[1];
        }
      }
    }

    if (textColor && bgColor && textDecl) {
      const ratio = checkContrast(textColor, bgColor);
      if (ratio != null && ratio < 4.5) {
        out.push({
          rule: "low-contrast",
          severity: "error",
          message: `Low contrast text (${ratio.toFixed(2)}:1) on "${rule.selector}". WCAG AA requires 4.5:1 for body text.`,
          line: textDecl.line,
          col: textDecl.col,
        });
      }
    }
  }
}

function ruleLowContrastCss(ctx: RuleContext, out: DesignFinding[]) {
  if (!ctx.isCss && !ctx.isHtmlLike && !ctx.isJsxLike) return;
  if (ctx.isCss) {
    const rules = parseCssRules(ctx.content);
    checkLowContrastCss(rules, out);
  }
  if (ctx.isHtmlLike) {
    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let sm = styleRe.exec(ctx.content);
    while (sm !== null) {
      const css = sm[1];
      const startIdx = sm.index + sm[0].indexOf(">") + 1;
      const { line: baseLine } = lineCol(ctx.content, startIdx);
      const rules = parseCssRules(css, baseLine);
      checkLowContrastCss(rules, out);
      sm = styleRe.exec(ctx.content);
    }
    const inlineStyles = extractInlineStyles(ctx.content);
    for (const { style, index } of inlineStyles) {
      const { line: baseLine } = lineCol(ctx.content, index);
      const dummy = `.inline { ${style} }`;
      const rules = parseCssRules(dummy, baseLine);
      checkLowContrastCss(rules, out);
    }
  }
  if (ctx.isJsxLike) {
    const styleObjRe = /style\s*=\s*\{\s*\{([^}]+)\}\s*\}/g;
    let jm = styleObjRe.exec(ctx.content);
    while (jm !== null) {
      const objBody = jm[1];
      const { line: baseLine } = lineCol(ctx.content, jm.index);
      const colorMatch = objBody.match(/color\s*:\s*["']([^"']+)["']/);
      const bgMatch = objBody.match(/backgroundColor\s*:\s*["']([^"']+)["']/);
      if (colorMatch && bgMatch) {
        const ratio = checkContrast(colorMatch[1], bgMatch[1]);
        if (ratio != null && ratio < 4.5) {
          out.push({
            rule: "low-contrast",
            severity: "error",
            message: `Low contrast inline style (${ratio.toFixed(2)}:1). WCAG AA requires 4.5:1 for body text.`,
            line: baseLine,
            col: 1,
          });
        }
      }
      jm = styleObjRe.exec(ctx.content);
    }
    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let sm = styleRe.exec(ctx.content);
    while (sm !== null) {
      const css = sm[1];
      const startIdx = sm.index + sm[0].indexOf(">") + 1;
      const { line: baseLine } = lineCol(ctx.content, startIdx);
      const rules = parseCssRules(css, baseLine);
      checkLowContrastCss(rules, out);
      sm = styleRe.exec(ctx.content);
    }
  }
}

function extractInlineStyles(content: string): Array<{ style: string; index: number }> {
  const out: Array<{ style: string; index: number }> = [];
  const re = /style\s*=\s*["']([^"']+)["']/gi;
  let m = re.exec(content);
  while (m !== null) {
    out.push({ style: m[1], index: m.index });
    m = re.exec(content);
  }
  return out;
}

// ── Tailwind rules ───────────────────────────────────────────────────

function ruleTailwindClasses(ctx: RuleContext, out: DesignFinding[]) {
  const classBlocks = extractTailwindClasses(ctx.content);

  // Global counters for file-level rules
  let textCenterCount = 0;
  let lastTextCenterLine = 0;

  for (const block of classBlocks) {
    const { classes, line } = block;

    checkTailwindContrast(classes, line, out);
    checkTailwindAiGradient(classes, line, out);
    checkTailwindFontSize(classes, line, out);
    checkTailwindLineHeight(classes, line, out);
    checkTailwindPadding(classes, line, out);
    checkTailwindPureBlack(classes, line, out);
    checkTailwindJustified(classes, line, out);
    checkTailwindUppercase(classes, line, out);
    checkTailwindGradientText(classes, line, out);
    checkTailwindSideTab(classes, line, out);

    if (classes.includes("text-center")) {
      textCenterCount++;
      lastTextCenterLine = line;
    }
  }

  if (textCenterCount >= 3) {
    out.push({
      rule: "everything-centered",
      severity: "warning",
      message:
        "Multiple text-center utilities detected. Left-align text with asymmetric layouts feels more designed. Center only hero sections and CTAs.",
      line: lastTextCenterLine,
      col: 1,
    });
  }
}

// ── Register built-in rules ──────────────────────────────────────────

function registerBuiltinRules() {
  RULES.push(ruleAiGradients);
  RULES.push(ruleGradientText);
  RULES.push(ruleOverusedFonts);
  RULES.push(ruleAllCapsBody);
  RULES.push(ruleEverythingCentered);
  RULES.push(ruleNestedCards);
  RULES.push(ruleLowContrastCss);
  RULES.push(ruleSideTabBorder);
  RULES.push(ruleBounceEasing);
  RULES.push(ruleLayoutAnimation);
  RULES.push(rulePureBlackBg);
  RULES.push(ruleSkippedHeadings);
  RULES.push(ruleTinyBodyText);
  RULES.push(ruleTightLineHeight);
  RULES.push(ruleWideLetterSpacing);
  RULES.push(ruleJustifiedText);
  RULES.push(ruleCrampedPadding);
  RULES.push(ruleTailwindClasses);
}

// Ensure builtins are registered once on module load
registerBuiltinRules();

// ── Main entry ───────────────────────────────────────────────────────

export function checkDesign(
  filePath: string,
  content: string,
  designSystem: DesignSystem | null = null,
): DesignFinding[] {
  const out: DesignFinding[] = [];
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const ctx: RuleContext = {
    filePath,
    content,
    ext,
    isCss: ext === "css" || ext === "scss" || ext === "less" || ext === "sass",
    isHtmlLike: ext === "svelte" || ext === "vue" || ext === "html" || ext === "astro",
    isJsxLike: ext === "jsx" || ext === "tsx" || ext === "js" || ext === "ts",
    designSystem,
  };

  for (const rule of RULES) {
    try {
      rule(ctx, out);
    } catch (err) {
      // Individual rules must not crash the whole check
      out.push({
        rule: "design-check-error",
        severity: "info",
        message: `Design rule crashed: ${(err as Error).message}`,
      });
    }
  }

  return out;
}

/*
 * ── Phase 3: Full-Page Scan Mode (Deferred) ──────────────────────────
 *
 * Currently, runtime DOM detection (picker.ts) only scans the selected
 * element and its ancestors. This catches nested cards and per-element
 * issues but misses site-wide problems like:
 *   - Everything centered (needs to count text-align:center across page)
 *   - Overused fonts (needs to check font-family across all elements)
 *   - Skipped heading levels (needs full page heading hierarchy)
 *   - Bounce/elastic easing (needs animation inspection)
 *   - Layout property animations (needs transition inspection)
 *
 * Implementation plan for Phase 3:
 * 1. Add a "Scan Page" button to the overlay UI
 * 2. On click, walk document.body recursively (respecting shadow DOM)
 * 3. Collect computed styles from all visible elements
 * 4. Build aggregates: heading hierarchy, font usage stats, alignment stats
 * 5. Deduplicate findings by rule+location
 * 6. Send results to server as a synthetic "scan" message
 * 7. Server stores findings in a separate scan state (not tied to threads)
 * 8. Overlay displays a summary panel with all findings
 *
 * This requires careful performance management: throttle the walk,
 * skip invisible elements, and limit to ~500 elements max.
 */
