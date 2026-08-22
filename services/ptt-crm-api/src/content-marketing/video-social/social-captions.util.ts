import sharp from 'sharp';
import type { CmktVideoBeat } from '../content-marketing.types';

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function msToAssTime(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1_000);
  const cs = Math.floor((clamped % 1_000) / 10);
  return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\r?\n/g, '\\N');
}

export function buildAss(beats: CmktVideoBeat[], width = 1080, height = 1920): string {
  const dialogues = beats
    .filter((b) => b.on_screen_text?.trim())
    .map((b) => {
      const start = msToAssTime(b.start_ms);
      const end = msToAssTime(Math.max(b.start_ms, b.end_ms));
      const text = escapeAssText(b.on_screen_text.trim());
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    });

  return [
    '[Script Info]',
    'Title: CMKT Social',
    'ScriptType: v4.00+',
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    'Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,40,40,80,1',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...dialogues,
    '',
  ].join('\n');
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function writeTextOverlayPng(input: {
  path: string;
  width: number;
  height: number;
  text: string;
  yPct: number;
  fontSize: number;
  opacity?: number;
  rotateDeg?: number;
}): Promise<void> {
  const { path, width, height, text, yPct, fontSize, opacity = 1, rotateDeg = 0 } = input;
  const fill = `rgba(255,255,255,${opacity})`;
  const transform = rotateDeg
    ? ` transform="rotate(${rotateDeg} ${width / 2} ${height / 2})"`
    : '';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${width / 2}" y="${Math.round(height * yPct)}" text-anchor="middle" dominant-baseline="middle" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" fill="${fill}"${transform}>${escapeXml(text)}</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path);
}
