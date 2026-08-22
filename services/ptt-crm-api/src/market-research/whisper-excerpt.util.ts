import type { WhisperExcerpt } from './market-research.types';

const MAX_EXCERPT = 500;
const MAX_EXCERPTS = 12;
const CHUNK_CHARS = 400;
const SECONDS_PER_CHUNK = 30;

export function excerptsFromTranscript(text: string): WhisperExcerpt[] {
  const raw = String(text ?? '').trim();
  if (!raw) return [];

  let chunks = raw
    .split(/(?<=[.?!])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (chunks.length <= 1 && raw.length > MAX_EXCERPT) {
    chunks = splitEvery(raw, CHUNK_CHARS);
  } else {
    chunks = chunks.flatMap((part) =>
      part.length > MAX_EXCERPT ? splitEvery(part, CHUNK_CHARS) : [part],
    );
  }

  return chunks.slice(0, MAX_EXCERPTS).map((excerpt, index) => ({
    locator: formatLocator(index * SECONDS_PER_CHUNK),
    excerpt: excerpt.slice(0, MAX_EXCERPT),
  }));
}

export function assertNoRawInPayload(json: unknown): void {
  if (hasForbiddenRawKey(json)) {
    throw Object.assign(new Error('raw_transcript_forbidden'), { code: 'raw_transcript_forbidden' });
  }
  const raw = JSON.stringify(json);
  if (raw.length > 8000) {
    throw Object.assign(new Error('raw_transcript_forbidden'), { code: 'raw_transcript_forbidden' });
  }
}

function splitEvery(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    const piece = text.slice(i, i + size).trim();
    if (piece) out.push(piece);
  }
  return out;
}

function formatLocator(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `T-${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function hasForbiddenRawKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenRawKey);
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  if ('transcript' in rec || 'audio_uri' in rec || 'raw' in rec) return true;
  return Object.values(rec).some(hasForbiddenRawKey);
}
