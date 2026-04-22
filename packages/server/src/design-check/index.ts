export { checkDesign, registerRule, clearRules, getRules } from "./rules.js";
export type { DesignFinding, RuleContext, DesignRule } from "./rules.js";
export {
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
  setCustomThemeColors,
  clearCustomThemeColors,
} from "./tailwind.js";
export { parseColor, checkContrast, relativeLuminance, contrastRatio } from "./color.js";
export type { SRGB } from "./color.js";
export { checkDesignMdTokens } from "./designmd-rule.js";
