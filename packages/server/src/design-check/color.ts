// Lightweight color parser + contrast calculator (no dependencies)
// Supports hex, rgb/rgba, hsl/hsla, oklch, oklab, lch, lab

export interface SRGB {
  r: number; // 0-255
  g: number;
  b: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, n));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ── Parsing ──────────────────────────────────────────────────────────

function parseNumberOrPercent(token: string, max = 1): number | null {
  const t = token.trim();
  if (t.endsWith("%")) {
    const v = parseFloat(t);
    if (Number.isNaN(v)) return null;
    return (v / 100) * max;
  }
  const v = parseFloat(t);
  if (Number.isNaN(v)) return null;
  return max === 255 ? v : v;
}

function parseHexColor(str: string): SRGB | null {
  const m = str.match(
    /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
  );
  if (!m) return null;
  const hex = m[1];
  if (hex.length === 3 || hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return { r, g, b };
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
}

function parseRgbLike(
  inner: string,
): { r: number; g: number; b: number; a?: number } | null {
  // Try modern space-separated syntax first: 255 128 0 / 0.5
  const modern = inner.match(
    /^\s*([\d.]+(?:%)?)\s+([\d.]+(?:%)?)\s+([\d.]+(?:%)?)\s*(?:\/\s*([\d.]+%?))?\s*$/,
  );
  if (modern) {
    const r = parseNumberOrPercent(modern[1], 255);
    const g = parseNumberOrPercent(modern[2], 255);
    const b = parseNumberOrPercent(modern[3], 255);
    if (r == null || g == null || b == null) return null;
    let a = 1;
    if (modern[4]) {
      const av = parseNumberOrPercent(modern[4], 1);
      if (av != null) a = av;
    }
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a };
  }
  // Legacy comma-separated: 255, 128, 0 or 255, 128, 0, 0.5
  const legacy = inner.match(
    /^\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*(?:,\s*([\d.]+%?))?\s*$/,
  );
  if (legacy) {
    const r = parseNumberOrPercent(legacy[1], 255);
    const g = parseNumberOrPercent(legacy[2], 255);
    const b = parseNumberOrPercent(legacy[3], 255);
    if (r == null || g == null || b == null) return null;
    let a = 1;
    if (legacy[4]) {
      const av = parseNumberOrPercent(legacy[4], 1);
      if (av != null) a = av;
    }
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a };
  }
  return null;
}

function parseHslLike(
  inner: string,
): { h: number; s: number; l: number; a?: number } | null {
  // Try modern: 200 50% 50% / 0.5
  const modern = inner.match(
    /^\s*([\d.]+(?:deg|rad|turn)?)\s+([\d.]+%)\s+([\d.]+%)\s*(?:\/\s*([\d.]+%?))?\s*$/,
  );
  if (modern) {
    let h = parseFloat(modern[1]);
    if (modern[1].includes("rad")) h = (h * 180) / Math.PI;
    else if (modern[1].includes("turn")) h = h * 360;
    const s = parseNumberOrPercent(modern[2], 1);
    const l = parseNumberOrPercent(modern[3], 1);
    if (s == null || l == null) return null;
    let a = 1;
    if (modern[4]) {
      const av = parseNumberOrPercent(modern[4], 1);
      if (av != null) a = av;
    }
    return { h: ((h % 360) + 360) % 360, s: clamp01(s), l: clamp01(l), a };
  }
  // Legacy comma-separated
  const legacy = inner.match(
    /^\s*([\d.]+(?:deg|rad|turn)?)\s*,\s*([\d.]+%)\s*,\s*([\d.]+%)\s*(?:,\s*([\d.]+%?))?\s*$/,
  );
  if (legacy) {
    let h = parseFloat(legacy[1]);
    if (legacy[1].includes("rad")) h = (h * 180) / Math.PI;
    else if (legacy[1].includes("turn")) h = h * 360;
    const s = parseNumberOrPercent(legacy[2], 1);
    const l = parseNumberOrPercent(legacy[3], 1);
    if (s == null || l == null) return null;
    let a = 1;
    if (legacy[4]) {
      const av = parseNumberOrPercent(legacy[4], 1);
      if (av != null) a = av;
    }
    return { h: ((h % 360) + 360) % 360, s: clamp01(s), l: clamp01(l), a };
  }
  return null;
}

function hslToRgb(h: number, s: number, l: number): SRGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (hh < 1) {
    r = c;
    g = x;
  } else if (hh < 2) {
    r = x;
    g = c;
  } else if (hh < 3) {
    g = c;
    b = x;
  } else if (hh < 4) {
    g = x;
    b = c;
  } else if (hh < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function parseOklchLike(
  inner: string,
): { L: number; C: number; H: number; a?: number } | null {
  const m = inner.match(
    /^\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+(?:deg)?)\s*(?:\/\s*([\d.]+%?))?\s*$/,
  );
  if (!m) return null;
  const L = parseNumberOrPercent(m[1], 1);
  const C = parseFloat(m[2]);
  let H = parseFloat(m[3]);
  if (m[3].includes("deg")) H = parseFloat(m[3]);
  if (L == null || Number.isNaN(C) || Number.isNaN(H)) return null;
  let a = 1;
  if (m[4]) {
    const av = parseNumberOrPercent(m[4], 1);
    if (av != null) a = av;
  }
  return { L: clamp01(L), C: Math.max(0, C), H: ((H % 360) + 360) % 360, a };
}

function parseOklabLike(
  inner: string,
): { L: number; a: number; b: number; alpha?: number } | null {
  const m = inner.match(
    /^\s*([\d.]+%?)\s+([\d.-]+)\s+([\d.-]+)\s*(?:\/\s*([\d.]+%?))?\s*$/,
  );
  if (!m) return null;
  const L = parseNumberOrPercent(m[1], 1);
  const a = parseFloat(m[2]);
  const b = parseFloat(m[3]);
  if (L == null || Number.isNaN(a) || Number.isNaN(b)) return null;
  let alpha = 1;
  if (m[4]) {
    const av = parseNumberOrPercent(m[4], 1);
    if (av != null) alpha = av;
  }
  return { L: clamp01(L), a, b, alpha };
}

function parseLchLike(
  inner: string,
): { L: number; C: number; H: number; a?: number } | null {
  const m = inner.match(
    /^\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+(?:deg)?)\s*(?:\/\s*([\d.]+%?))?\s*$/,
  );
  if (!m) return null;
  const L = parseNumberOrPercent(m[1], 100); // L in LCH is 0-100 typically
  const C = parseFloat(m[2]);
  let H = parseFloat(m[3]);
  if (m[3].includes("deg")) H = parseFloat(m[3]);
  if (L == null || Number.isNaN(C) || Number.isNaN(H)) return null;
  let a = 1;
  if (m[4]) {
    const av = parseNumberOrPercent(m[4], 1);
    if (av != null) a = av;
  }
  return { L, C: Math.max(0, C), H: ((H % 360) + 360) % 360, a };
}

function parseLabLike(
  inner: string,
): { L: number; a: number; b: number; alpha?: number } | null {
  const m = inner.match(
    /^\s*([\d.]+%?)\s+([\d.-]+)\s+([\d.-]+)\s*(?:\/\s*([\d.]+%?))?\s*$/,
  );
  if (!m) return null;
  const L = parseNumberOrPercent(m[1], 100);
  const a = parseFloat(m[2]);
  const b = parseFloat(m[3]);
  if (L == null || Number.isNaN(a) || Number.isNaN(b)) return null;
  let alpha = 1;
  if (m[4]) {
    const av = parseNumberOrPercent(m[4], 1);
    if (av != null) alpha = av;
  }
  return { L, a, b, alpha };
}

// ── Color-space conversions ──────────────────────────────────────────

// OKLab → LMS → XYZ → linear sRGB
function oklabToSrgb(L: number, a: number, b: number): SRGB | null {
  // Oklab to LMS' (linear)
  const lms1 = L + 0.3963377774 * a + 0.2158037573 * b;
  const lms2 = L - 0.1055613458 * a - 0.0638541728 * b;
  const lms3 = L - 0.0894841775 * b - 1.2914855480 * b; // wait, this is wrong
  // Let me recalculate: matrix row is [1.0, -0.0894841775, -1.2914855480]
  // So lms3 = 1.0*L + (-0.0894841775)*a + (-1.2914855480)*b
  const lms3_fixed = L - 0.0894841775 * a - 1.2914855480 * b;

  // LMS' to LMS (cube)
  const LMS1 = Math.pow(lms1, 3);
  const LMS2 = Math.pow(lms2, 3);
  const LMS3 = Math.pow(lms3_fixed, 3);

  // LMS to XYZ (D65)
  const X = 1.2268139 * LMS1 - 0.5574882 * LMS2 + 0.2818461 * LMS3;
  const Y = -0.0405802 * LMS1 + 1.1122567 * LMS2 - 0.0716766 * LMS3;
  const Z = -0.0763805 * LMS1 - 0.4214820 * LMS2 + 1.5866323 * LMS3;

  // XYZ to linear sRGB
  const rl = 3.2409699 * X - 1.5373832 * Y - 0.4986108 * Z;
  const gl = -0.9692436 * X + 1.8759675 * Y + 0.0415551 * Z;
  const bl = 0.0556301 * X - 0.2039770 * Y + 1.0569715 * Z;

  // Gamma correction
  const toSrgb = (c: number): number => {
    if (c <= 0.0031308) return c * 12.92;
    return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  return {
    r: clamp255(Math.round(toSrgb(rl) * 255)),
    g: clamp255(Math.round(toSrgb(gl) * 255)),
    b: clamp255(Math.round(toSrgb(bl) * 255)),
  };
}

function oklchToSrgb(L: number, C: number, H: number): SRGB | null {
  const rad = toRad(H);
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  return oklabToSrgb(L, a, b);
}

// CIELAB → XYZ → linear sRGB
function labToXyz(L: number, a: number, b: number): { X: number; Y: number; Z: number } {
  const Xn = 95.047;
  const Yn = 100.0;
  const Zn = 108.883;
  const delta = 6 / 29;
  const threshold = delta * delta * delta; // 0.00885645

  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;

  const fx3 = fx * fx * fx;
  const fy3 = fy * fy * fy;
  const fz3 = fz * fz * fz;

  const xr = fx3 > threshold ? fx3 : (fx - 16 / 116) / 7.787;
  const yr = fy3 > threshold ? fy3 : (fy - 16 / 116) / 7.787;
  const zr = fz3 > threshold ? fz3 : (fz - 16 / 116) / 7.787;

  return { X: xr * Xn, Y: yr * Yn, Z: zr * Zn };
}

function xyzToSrgb(X: number, Y: number, Z: number): SRGB {
  const rl = 3.2409699 * X - 1.5373832 * Y - 0.4986108 * Z;
  const gl = -0.9692436 * X + 1.8759675 * Y + 0.0415551 * Z;
  const bl = 0.0556301 * X - 0.2039770 * Y + 1.0569715 * Z;

  const toSrgb = (c: number): number => {
    if (c <= 0.0031308) return c * 12.92;
    return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  return {
    r: clamp255(Math.round(toSrgb(rl) * 255)),
    g: clamp255(Math.round(toSrgb(gl) * 255)),
    b: clamp255(Math.round(toSrgb(bl) * 255)),
  };
}

function labToSrgb(L: number, a: number, b: number): SRGB {
  const { X, Y, Z } = labToXyz(L, a, b);
  return xyzToSrgb(X, Y, Z);
}

function lchToSrgb(L: number, C: number, H: number): SRGB {
  const rad = toRad(H);
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  return labToSrgb(L, a, b);
}

// ── Public parse function ────────────────────────────────────────────

export function parseColor(str: string): SRGB | null {
  const s = str.trim().toLowerCase();

  // Named colors (common subset)
  const named: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    gray: "#808080",
    grey: "#808080",
    darkgray: "#a9a9a9",
    darkgrey: "#a9a9a9",
    lightgray: "#d3d3d3",
    lightgrey: "#d3d3d3",
    orange: "#ffa500",
    purple: "#800080",
    violet: "#ee82ee",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    yellow: "#ffff00",
    pink: "#ffc0cb",
    brown: "#a52a2a",
    navy: "#000080",
    teal: "#008080",
    lime: "#00ff00",
    indigo: "#4b0082",
    crimson: "#dc143c",
    gold: "#ffd700",
    silver: "#c0c0c0",
    transparent: "#000000",
  };
  if (named[s]) {
    return parseHexColor(named[s]);
  }

  // Hex
  const hex = parseHexColor(s);
  if (hex) return hex;

  // rgb / rgba
  const rgbMatch = s.match(/^rgba?\((.*)\)$/);
  if (rgbMatch) {
    const parsed = parseRgbLike(rgbMatch[1]);
    if (parsed) return { r: parsed.r, g: parsed.g, b: parsed.b };
  }

  // hsl / hsla
  const hslMatch = s.match(/^hsla?\((.*)\)$/);
  if (hslMatch) {
    const parsed = parseHslLike(hslMatch[1]);
    if (parsed) return hslToRgb(parsed.h, parsed.s, parsed.l);
  }

  // oklch
  const oklchMatch = s.match(/^oklch\((.*)\)$/);
  if (oklchMatch) {
    const parsed = parseOklchLike(oklchMatch[1]);
    if (parsed) return oklchToSrgb(parsed.L, parsed.C, parsed.H);
  }

  // oklab
  const oklabMatch = s.match(/^oklab\((.*)\)$/);
  if (oklabMatch) {
    const parsed = parseOklabLike(oklabMatch[1]);
    if (parsed) return oklabToSrgb(parsed.L, parsed.a, parsed.b);
  }

  // lch
  const lchMatch = s.match(/^lch\((.*)\)$/);
  if (lchMatch) {
    const parsed = parseLchLike(lchMatch[1]);
    if (parsed) return lchToSrgb(parsed.L, parsed.C, parsed.H);
  }

  // lab
  const labMatch = s.match(/^lab\((.*)\)$/);
  if (labMatch) {
    const parsed = parseLabLike(labMatch[1]);
    if (parsed) return labToSrgb(parsed.L, parsed.a, parsed.b);
  }

  return null;
}

// ── Contrast ─────────────────────────────────────────────────────────

export function relativeLuminance(srgb: SRGB): number {
  const toLinear = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const R = toLinear(srgb.r);
  const G = toLinear(srgb.g);
  const B = toLinear(srgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contrastRatio(c1: SRGB, c2: SRGB): number {
  const l1 = relativeLuminance(c1) + 0.05;
  const l2 = relativeLuminance(c2) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

// Convenience: check if a string color meets WCAG AA (4.5:1 body, 3:1 large)
export function checkContrast(fgStr: string, bgStr: string): number | null {
  const fg = parseColor(fgStr);
  const bg = parseColor(bgStr);
  if (!fg || !bg) return null;
  return contrastRatio(fg, bg);
}
