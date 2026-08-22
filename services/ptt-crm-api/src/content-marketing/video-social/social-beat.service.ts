import type { CmktVideoBeat } from '../content-marketing.types';
import { extractClipKeywords } from '../content-media-stock.provider';

const BEAT_IDS: CmktVideoBeat['id'][] = ['hook', 'pain', 'proof', 'cta'];

function splitScript(script: string): string[] {
  const trimmed = script.trim();
  if (!trimmed) {
    return [''];
  }

  const paragraphs = trimmed
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs;
  }

  const sentences = trimmed
    .split(/\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith('.') ? s : `${s}.`));

  if (sentences.length > 1) {
    return sentences;
  }

  return [trimmed];
}

function assignExcerpts(segments: string[]): string[] {
  if (segments.length >= 4) {
    return segments.slice(0, 4);
  }

  const excerpts = [...segments];
  while (excerpts.length < 4) {
    excerpts.push(excerpts[excerpts.length - 1]);
  }
  return excerpts;
}

function firstWords(text: string, count: number): string {
  return text.trim().split(/\s+/).filter(Boolean).slice(0, count).join(' ');
}

function computeBeatTimings(durationSec: number): Array<{ start_ms: number; end_ms: number }> {
  const totalMs = durationSec * 1000;
  const hookEnd = 3000;
  const ctaStart = totalMs - 4000;
  const middleMs = Math.max(0, ctaStart - hookEnd);
  const painEnd = hookEnd + Math.floor(middleMs / 2);
  const proofEnd = hookEnd + middleMs;

  return [
    { start_ms: 0, end_ms: hookEnd },
    { start_ms: hookEnd, end_ms: painEnd },
    { start_ms: painEnd, end_ms: proofEnd },
    { start_ms: ctaStart, end_ms: totalMs },
  ];
}

export function parseBeats(script: string, durationSec: number): CmktVideoBeat[] {
  const segments = splitScript(script);
  const excerpts = assignExcerpts(segments);
  const timings = computeBeatTimings(durationSec);

  return BEAT_IDS.map((id, index) => {
    const excerpt = excerpts[index];
    return {
      id,
      start_ms: timings[index].start_ms,
      end_ms: timings[index].end_ms,
      script_excerpt: excerpt,
      keywords: extractClipKeywords(excerpt),
      clip_id: null,
      on_screen_text: firstWords(excerpt, 8),
      locked: false,
    };
  });
}
