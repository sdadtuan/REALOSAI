export type CmktBrandPalette = {
  colors: string[];
  source: string;
};

export type CmktImageQaAnalysis = {
  brand_delta_e_max: number | null;
  brand_delta_e_avg: number | null;
  ocr_confidence: number;
  contrast_ratio: number;
  dominant_hex: string | null;
};

const DEFAULT_PALETTE = ['#1e3a5f', '#c0392b', '#ffffff', '#222222'];

export function extractBrandPalette(brand: Record<string, unknown>): CmktBrandPalette {
  const raw =
    brand.palette_colors ??
    brand.brand_colors ??
    brand.colors ??
    brand.color_palette;
  const colors: string[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === 'string' && /^#[0-9a-f]{6}$/i.test(entry.trim())) {
        colors.push(entry.trim().toLowerCase());
      } else if (entry && typeof entry === 'object' && 'hex' in (entry as object)) {
        const hex = String((entry as { hex?: string }).hex ?? '').trim();
        if (/^#[0-9a-f]{6}$/i.test(hex)) colors.push(hex.toLowerCase());
      }
    }
  }
  return {
    colors: colors.length ? colors.slice(0, 8) : DEFAULT_PALETTE,
    source: String(brand._source ?? 'default'),
  };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = match[1]!;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToLab(r: number, g: number, b: number): { l: number; a: number; b: number } {
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;
  rr = rr > 0.04045 ? ((rr + 0.055) / 1.055) ** 2.4 : rr / 12.92;
  gg = gg > 0.04045 ? ((gg + 0.055) / 1.055) ** 2.4 : gg / 12.92;
  bb = bb > 0.04045 ? ((bb + 0.055) / 1.055) ** 2.4 : bb / 12.92;
  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;
  const fx = x > 0.008856 ? x ** (1 / 3) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? y ** (1 / 3) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? z ** (1 / 3) : 7.787 * z + 16 / 116;
  return { l: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function deltaE76(
  a: { l: number; a: number; b: number },
  b: { l: number; a: number; b: number },
): number {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

export function minDeltaEToPalette(
  rgb: { r: number; g: number; b: number },
  palette: string[],
): number {
  const sampleLab = rgbToLab(rgb.r, rgb.g, rgb.b);
  let min = Number.POSITIVE_INFINITY;
  for (const hex of palette) {
    const parsed = hexToRgb(hex);
    if (!parsed) continue;
    const lab = rgbToLab(parsed.r, parsed.g, parsed.b);
    min = Math.min(min, deltaE76(sampleLab, lab));
  }
  return Number.isFinite(min) ? Math.round(min * 10) / 10 : 999;
}

export async function analyzeImageBuffer(
  buffer: Buffer,
  input: { palette: string[]; expectedText?: string },
): Promise<CmktImageQaAnalysis> {
  try {
    const sharp = (await import('sharp')).default;
    const { dominant } = await sharp(buffer).stats();
    const dominantChannel = dominant;
    const rgb = {
      r: Math.round(dominantChannel.r),
      g: Math.round(dominantChannel.g),
      b: Math.round(dominantChannel.b),
    };
    const dominant_hex = `#${[rgb.r, rgb.g, rgb.b]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')}`;

    const brand_delta_e_max = minDeltaEToPalette(rgb, input.palette);
    const brand_delta_e_avg = brand_delta_e_max;

    const grey = await sharp(buffer).greyscale().raw().toBuffer({ resolveWithObject: true });
    const pixels = grey.data;
    let minL = 255;
    let maxL = 0;
    let edgeHits = 0;
    const width = grey.info.width;
    for (let i = 0; i < pixels.length; i++) {
      const v = pixels[i] ?? 0;
      minL = Math.min(minL, v);
      maxL = Math.max(maxL, v);
      if (i > width && Math.abs(v - (pixels[i - width] ?? v)) > 28) edgeHits += 1;
    }
    const contrast_ratio =
      maxL <= minL ? 1 : Math.round(((maxL + 5) / (minL + 5)) * 10) / 10;
    const edgeDensity = edgeHits / Math.max(pixels.length, 1);
    const textSignal = Math.min(1, edgeDensity * 12);
    const contrastSignal = Math.min(1, (contrast_ratio - 1) / 8);
    const lengthSignal = input.expectedText?.trim()
      ? Math.min(1, input.expectedText.trim().length / 80)
      : 0.55;
    const ocr_confidence = Math.round((textSignal * 0.45 + contrastSignal * 0.35 + lengthSignal * 0.2) * 100) / 100;

    return {
      brand_delta_e_max,
      brand_delta_e_avg,
      ocr_confidence,
      contrast_ratio,
      dominant_hex,
    };
  } catch {
    return {
      brand_delta_e_max: null,
      brand_delta_e_avg: null,
      ocr_confidence: 0.5,
      contrast_ratio: 4.5,
      dominant_hex: null,
    };
  }
}

export function scoreFromImageAnalysis(
  analysis: CmktImageQaAnalysis,
  baseChecks: Record<string, boolean>,
): { score: number; checks: Record<string, boolean>; blocked: boolean } {
  const brand_colors =
    analysis.brand_delta_e_max != null ? analysis.brand_delta_e_max <= 18 : baseChecks.brand_colors ?? true;
  const text_readable = analysis.ocr_confidence >= 0.55 && analysis.contrast_ratio >= 3;
  const checks = {
    ...baseChecks,
    brand_colors,
    text_readable,
    ocr_confidence_ok: analysis.ocr_confidence >= 0.55,
    brand_delta_e_ok: analysis.brand_delta_e_max != null ? analysis.brand_delta_e_max <= 18 : true,
    contrast_ok: analysis.contrast_ratio >= 3,
  };
  const penalty =
    (brand_colors ? 0 : 12) +
    (text_readable ? 0 : 10) +
    (checks.contrast_ok ? 0 : 6);
  const base = baseChecks.assets_present ? 78 : 55;
  const score = Math.max(0, Math.min(100, base - penalty + Math.round(analysis.ocr_confidence * 8)));
  return { score, checks, blocked: score < 50 };
}
