import {
  TicketSentimentFactor,
  TicketSentimentInput,
  TicketSentimentLabel,
  TicketSentimentSnapshot,
} from './ticket-sentiment.types';

const NEGATIVE_KEYWORDS = [
  'phan nan',
  'khieu nai',
  'te',
  'khong hai long',
  'hoan tien',
  'huy',
  'complaint',
  'angry',
  'bad service',
  'disappointed',
  'refund',
  'cancel',
];

const POSITIVE_KEYWORDS = [
  'cam on',
  'hai long',
  'tot',
  'ok',
  'thanks',
  'thank you',
  'great',
  'excellent',
];

function normalizeText(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function includesKeyword(text: string, keyword: string): boolean {
  if (keyword.includes(' ')) {
    return text.includes(keyword);
  }
  return ` ${text} `.includes(` ${keyword} `);
}

function countKeywordHits(text: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (includesKeyword(text, keyword)) hits += 1;
  }
  return hits;
}

export function computeTicketSentiment(input: TicketSentimentInput): TicketSentimentSnapshot {
  const text = normalizeText(`${input.title} ${input.description} ${input.resolution ?? ''}`);
  const factors: TicketSentimentFactor[] = [];
  let score = 50;

  const negativeHits = countKeywordHits(text, NEGATIVE_KEYWORDS);
  const positiveHits = countKeywordHits(text, POSITIVE_KEYWORDS);

  if (negativeHits > 0) {
    const delta = Math.min(negativeHits * 12, 36);
    score -= delta;
    factors.push({
      key: 'text_negative',
      label: `Từ khóa tiêu cực (${negativeHits})`,
      delta,
      sign: '-',
    });
  }

  if (positiveHits > 0) {
    const delta = Math.min(positiveHits * 10, 30);
    score += delta;
    factors.push({
      key: 'text_positive',
      label: `Từ khóa tích cực (${positiveHits})`,
      delta,
      sign: '+',
    });
  }

  const ticketType = normalizeText(input.ticket_type);
  if (ticketType === 'phan_nan' || ticketType === 'khieu_nai') {
    score -= 18;
    factors.push({ key: 'ticket_type', label: 'Loại phàn nàn/khiếu nại', delta: 18, sign: '-' });
  }

  const priority = normalizeText(input.priority);
  if (priority === 'khan_cap' || priority === 'cao') {
    score -= 8;
    factors.push({ key: 'priority', label: 'Ưu tiên cao/khẩn', delta: 8, sign: '-' });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let label: TicketSentimentLabel = 'neutral';
  if (score <= 35) label = 'negative';
  else if (score >= 65) label = 'positive';

  const signalCount = factors.length + (negativeHits + positiveHits > 0 ? 1 : 0);
  const confidence = Math.min(0.95, 0.45 + signalCount * 0.1);

  if (factors.length === 0) {
    factors.push({ key: 'neutral_default', label: 'Không đủ tín hiệu — mặc định trung tính', delta: 0, sign: '+' });
  }

  return { label, score, confidence: Math.round(confidence * 100) / 100, factors };
}
