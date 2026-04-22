import type { DesignFinding, RuleContext } from "./rules.js";
import { findClosestColorToken, tokenColorValues } from "../designmd/tokens.js";

const HEX = /#(?:[0-9a-fA-F]{6})\b/g;

export function checkDesignMdTokens(
  ctx: RuleContext,
  out: DesignFinding[],
): DesignFinding[] {
  const ds = ctx.designSystem;
  if (!ds) return out;
  const palette = new Set(tokenColorValues(ds));
  if (palette.size === 0) return out;
  const seen = new Set<string>();
  for (const m of ctx.content.matchAll(HEX)) {
    const hex = m[0].toLowerCase();
    if (palette.has(hex)) continue;
    if (seen.has(hex)) continue;
    seen.add(hex);
    const closest = findClosestColorToken(ds, hex);
    const before = ctx.content.slice(0, m.index ?? 0).split("\n");
    const line = before.length;
    const col = (before[before.length - 1]?.length ?? 0) + 1;
    const suggestion = closest
      ? ` — closest DESIGN.md token is \`colors.${closest.token}\` (${closest.value}); prefer \`var(--color-${closest.token})\`.`
      : "";
    out.push({
      rule: "design-md-token",
      severity: "warning",
      message: `Color ${hex} is not defined in DESIGN.md${suggestion}`,
      line,
      col,
    });
  }
  return out;
}
