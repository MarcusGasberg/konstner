import type { DesignFlag } from "@konstner/core";

export interface ScanResult {
  findings: DesignFlag[];
  stats: {
    elementsScanned: number;
    headings: { level: number; text: string }[];
    fontFamilies: Map<string, number>;
    centeredElements: number;
  };
}

interface ElementData {
  el: HTMLElement;
  cs: CSSStyleDeclaration;
  textLength: number;
  isVisible: boolean;
}

function isVisibleElement(el: HTMLElement): boolean {
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
}

function collectVisibleElements(root: HTMLElement, max = 500): ElementData[] {
  const out: ElementData[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.nextNode();
  while (node && out.length < max) {
    const el = node as HTMLElement;
    if (!isVisibleElement(el)) {
      node = walker.nextNode();
      continue;
    }
    const cs = getComputedStyle(el);
    const text = el.textContent ?? "";
    out.push({ el, cs, textLength: text.length, isVisible: true });
    node = walker.nextNode();
  }
  return out;
}

function checkHeadingHierarchy(elements: ElementData[]): DesignFlag[] {
  const flags: DesignFlag[] = [];
  const headings: Array<{ level: number; el: HTMLElement }> = [];

  for (const { el } of elements) {
    const match = el.tagName.match(/^H([1-6])$/i);
    if (match) {
      headings.push({ level: Number(match[1]), el });
    }
  }

  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    if (curr > prev + 1) {
      flags.push({
        rule: "skipped-heading",
        severity: "warning",
        message: `Skipped heading level: h${prev} → h${curr}. Heading levels should not skip.`,
      });
    }
  }

  return flags;
}

function checkOverusedFonts(elements: ElementData[]): DesignFlag[] {
  const flags: DesignFlag[] = [];
  const families = new Map<string, number>();

  for (const { cs } of elements) {
    const family = cs.fontFamily.split(",")[0].trim().replace(/['"]/g, "").toLowerCase();
    if (family && family !== "inherit" && family !== "initial") {
      families.set(family, (families.get(family) ?? 0) + 1);
    }
  }

  const overused = ["inter", "roboto", "open sans", "lato", "montserrat", "arial"];
  for (const [family, count] of families) {
    if (overused.includes(family)) {
      flags.push({
        rule: "overused-font",
        severity: "info",
        message: `Overused font detected: "${family}" (used on ${count} elements). Choose a distinctive font that gives your interface personality.`,
      });
    }
  }

  if (families.size === 1) {
    const [only] = families.keys();
    flags.push({
      rule: "single-font",
      severity: "info",
      message: `Only one font family ("${only}") is used for the entire page. Pair a display font with a body font to create typographic hierarchy.`,
    });
  }

  return flags;
}

function checkEverythingCentered(elements: ElementData[]): DesignFlag[] {
  const flags: DesignFlag[] = [];
  let centeredCount = 0;
  let totalTextElements = 0;

  for (const { cs, textLength } of elements) {
    if (textLength < 10) continue;
    totalTextElements++;
    if (cs.textAlign === "center") {
      centeredCount++;
    }
  }

  if (totalTextElements > 0 && centeredCount / totalTextElements > 0.5) {
    flags.push({
      rule: "everything-centered",
      severity: "warning",
      message: `${centeredCount} of ${totalTextElements} text elements are center-aligned. Left-align text with asymmetric layouts feels more designed. Center only hero sections and CTAs.`,
    });
  }

  return flags;
}

function checkLineLength(elements: ElementData[]): DesignFlag[] {
  const flags: DesignFlag[] = [];

  for (const { el, cs } of elements) {
    const text = el.textContent ?? "";
    if (text.length < 50) continue; // Skip short text
    const fontSize = parseFloat(cs.fontSize);
    if (!fontSize) continue;
    const width = el.getBoundingClientRect().width;
    const charsPerLine = width / (fontSize * 0.5); // rough estimate
    if (charsPerLine > 80) {
      flags.push({
        rule: "line-length-too-long",
        severity: "warning",
        message: `Text lines wider than ~80 characters are hard to read. Add a max-width (65ch to 75ch) to text containers.`,
      });
      break; // One finding is enough
    }
  }

  return flags;
}

function checkJustifiedText(elements: ElementData[]): DesignFlag[] {
  const flags: DesignFlag[] = [];

  for (const { cs, textLength } of elements) {
    if (textLength < 100) continue;
    if (cs.textAlign === "justify") {
      flags.push({
        rule: "justified-text",
        severity: "info",
        message: "Justified text without hyphenation creates uneven word spacing ('rivers of white'). Use text-align: left for body text.",
      });
      break;
    }
  }

  return flags;
}

function checkAnimations(elements: ElementData[]): DesignFlag[] {
  const flags: DesignFlag[] = [];

  for (const { cs } of elements) {
    const transition = cs.transition;
    if (transition && /\b(width|height|padding|margin|top|left|right|bottom)\b/.test(transition)) {
      flags.push({
        rule: "layout-animation",
        severity: "warning",
        message: "Animating width, height, padding, or margin causes layout thrash. Use transform and opacity instead.",
      });
      break;
    }
  }

  // Check for bounce/elastic easing in CSS animations
  const styleSheets = Array.from(document.styleSheets);
  for (const sheet of styleSheets) {
    try {
      const rules = Array.from(sheet.cssRules || sheet.rules || []);
      for (const rule of rules) {
        if (rule instanceof CSSKeyframesRule) {
          for (const frame of Array.from(rule.cssRules)) {
            const easing = (frame as CSSKeyframeRule).style.animationTimingFunction;
            if (easing && /cubic-bezier\s*\([^)]*\)/.test(easing)) {
              const nums = easing.match(/-?[\d.]+/g)?.map(Number) ?? [];
              if (nums.length >= 4) {
                const [, , y1, y2] = nums;
                if (y1 > 1.05 || y2 > 1.05 || y1 < -0.05 || y2 < -0.05) {
                  flags.push({
                    rule: "bounce-easing",
                    severity: "warning",
                    message: "Bounce or elastic easing feels dated. Use exponential easing (ease-out-quart/quint/expo) instead.",
                  });
                  return flags;
                }
              }
            }
          }
        }
      }
    } catch {
      // Cross-origin stylesheets may throw
    }
  }

  return flags;
}

function checkMonotonousSpacing(elements: ElementData[]): DesignFlag[] {
  const flags: DesignFlag[] = [];
  const gaps = new Map<string, number>();

  for (const { cs } of elements) {
    const gap = cs.gap || cs.rowGap || cs.columnGap;
    if (gap && gap !== "0px") {
      gaps.set(gap, (gaps.get(gap) ?? 0) + 1);
    }
  }

  if (gaps.size === 1) {
    const [value] = gaps.keys();
    flags.push({
      rule: "monotonous-spacing",
      severity: "info",
      message: `The same spacing value (${value}) is used everywhere. Use tight groupings for related items and generous separations between sections.`,
    });
  }

  return flags;
}

export function scanPage(): ScanResult {
  const findings: DesignFlag[] = [];
  const elements = collectVisibleElements(document.body);
  const headings: Array<{ level: number; text: string }> = [];
  const fontFamilies = new Map<string, number>();
  let centeredElements = 0;

  for (const { el, cs } of elements) {
    // Collect stats
    const match = el.tagName.match(/^H([1-6])$/i);
    if (match) {
      headings.push({ level: Number(match[1]), text: el.textContent?.slice(0, 50) ?? "" });
    }

    const family = cs.fontFamily.split(",")[0].trim().replace(/['"]/g, "").toLowerCase();
    if (family && family !== "inherit" && family !== "initial") {
      fontFamilies.set(family, (fontFamilies.get(family) ?? 0) + 1);
    }

    const text = el.textContent ?? "";
    if (text.length >= 10 && cs.textAlign === "center") {
      centeredElements++;
    }
  }

  // Run aggregate checks
  findings.push(...checkHeadingHierarchy(elements));
  findings.push(...checkOverusedFonts(elements));
  findings.push(...checkEverythingCentered(elements));
  findings.push(...checkLineLength(elements));
  findings.push(...checkJustifiedText(elements));
  findings.push(...checkAnimations(elements));
  findings.push(...checkMonotonousSpacing(elements));

  return {
    findings,
    stats: {
      elementsScanned: elements.length,
      headings,
      fontFamilies,
      centeredElements,
    },
  };
}
