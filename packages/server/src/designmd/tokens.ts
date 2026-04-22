import type { DesignSystem } from "./index.js";

export function tokenColorValues(ds: DesignSystem): string[] {
  return Object.values(ds.colors).map((v) => v.toLowerCase());
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export function findClosestColorToken(
  ds: DesignSystem,
  hex: string,
): { token: string; value: string; distance: number } | null {
  const target = parseHex(hex);
  if (!target) return null;
  let best: { token: string; value: string; distance: number } | null = null;
  for (const [token, value] of Object.entries(ds.colors)) {
    const rgb = parseHex(value);
    if (!rgb) continue;
    const dr = rgb[0] - target[0];
    const dg = rgb[1] - target[1];
    const db = rgb[2] - target[2];
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (!best || distance < best.distance) {
      best = { token, value, distance };
    }
  }
  return best;
}

export function toCssVars(ds: DesignSystem): string {
  const lines: string[] = [":root {"];
  for (const [name, value] of Object.entries(ds.colors)) {
    lines.push(`  --color-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(ds.rounded)) {
    lines.push(`  --rounded-${name}: ${value};`);
  }
  for (const [name, value] of Object.entries(ds.spacing)) {
    lines.push(`  --spacing-${name}: ${value};`);
  }
  for (const [name, t] of Object.entries(ds.typography)) {
    if (t.fontFamily) lines.push(`  --font-${name}-family: ${t.fontFamily};`);
    if (t.fontSize) lines.push(`  --font-${name}-size: ${t.fontSize};`);
    if (t.fontWeight != null) lines.push(`  --font-${name}-weight: ${t.fontWeight};`);
    if (t.lineHeight != null) lines.push(`  --font-${name}-line-height: ${t.lineHeight};`);
  }
  lines.push("}");
  return lines.join("\n");
}
