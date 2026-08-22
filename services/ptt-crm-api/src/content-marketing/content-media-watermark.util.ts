type PlaceholderOpts = {
  width: number;
  height: number;
  title: string;
  subtitle: string;
  stylePreset: string;
  seed: string;
};

const PRESET_COLORS: Record<string, { bg: string; fg: string }> = {
  corporate: { bg: '#1e3a5f', fg: '#ffffff' },
  bold: { bg: '#c0392b', fg: '#ffffff' },
  minimal: { bg: '#f5f5f5', fg: '#222222' },
  playful: { bg: '#6b5bff', fg: '#ffffff' },
};

/** Minimal 1×1 PNG for environments without sharp. */
export const MINIMAL_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export async function renderPlaceholderImageBuffer(opts: PlaceholderOpts): Promise<Buffer> {
  const colors = PRESET_COLORS[opts.stylePreset] ?? PRESET_COLORS.corporate;
  try {
    const sharp = (await import('sharp')).default;
    const svg = buildPlaceholderSvg(opts, colors.bg, colors.fg);
    return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
  } catch {
    return MINIMAL_PNG_BUFFER;
  }
}

export async function applyDraftWatermarkToBuffer(buffer: Buffer, enabled: boolean): Promise<Buffer> {
  if (!enabled) return buffer;
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(buffer).metadata();
    const width = meta.width ?? 1080;
    const height = meta.height ?? 1080;
    const fontSize = Math.max(28, Math.floor(Math.min(width, height) / 14));
    const overlay = Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700"
          fill="rgba(255,255,255,0.55)" text-anchor="middle" dominant-baseline="middle"
          transform="rotate(-24 ${width / 2} ${height / 2})">DRAFT</text>
      </svg>`,
    );
    return sharp(buffer)
      .composite([{ input: overlay, blend: 'over' }])
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return buffer;
  }
}

function buildPlaceholderSvg(
  opts: PlaceholderOpts,
  bg: string,
  fg: string,
): string {
  const safeTitle = escapeXml(opts.title.slice(0, 48));
  const safeSub = escapeXml(opts.subtitle.slice(0, 64));
  return `<svg width="${opts.width}" height="${opts.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}"/>
        <stop offset="100%" stop-color="${adjustColor(bg)}"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="48" y="72" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="${fg}">${safeTitle}</text>
    <text x="48" y="130" font-family="Arial,sans-serif" font-size="28" fill="${fg}" opacity="0.85">${safeSub}</text>
    <text x="48" y="${opts.height - 36}" font-family="monospace" font-size="18" fill="${fg}" opacity="0.5">${escapeXml(opts.seed.slice(0, 16))}</text>
  </svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function adjustColor(hex: string): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 30);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 30);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 30);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
