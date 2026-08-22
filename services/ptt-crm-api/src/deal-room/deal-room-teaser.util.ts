import { createHash, randomBytes } from 'crypto';
import { PRELIMINARY_STRATEGY_KEYS } from '../leads-funnel/presales-marketing-plan.util';

export const TEASER_STRATEGY_LABELS: Record<string, string> = {
  market_message: 'Thông điệp thị trường',
  media_reach: 'Phủ sóng truyền thông',
  conversion_strategy: 'Chiến lược chuyển đổi',
};

export function hashDealTeaserToken(raw: string): string {
  return createHash('sha256').update(String(raw ?? '').trim()).digest('hex');
}

export function generateDealTeaserToken(): string {
  return randomBytes(32).toString('base64url');
}

export function buildDealTeaserUrl(portalPublicUrl: string, rawToken: string): string {
  const base = String(portalPublicUrl ?? '').replace(/\/$/, '');
  return `${base}/p/deal/${encodeURIComponent(rawToken)}`;
}

export function teaserExpiresAt(ttlDays: number): Date {
  const days = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 14;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function buildTeaserStrategyBlocks(
  strategyFramework: Record<string, string>,
): Array<{ key: string; label: string; content: string }> {
  return PRELIMINARY_STRATEGY_KEYS.map((key) => ({
    key,
    label: TEASER_STRATEGY_LABELS[key] ?? key,
    content: String(strategyFramework[key] ?? '').trim(),
  })).filter((block) => block.content.length > 0);
}

export function buildTeaserMailtoHref(projectName: string, amName: string | null): string {
  const subject = encodeURIComponent(`Quan tâm dự án: ${projectName}`.slice(0, 120));
  const body = encodeURIComponent(
    `Xin chào${amName ? ` ${amName}` : ''},\n\nTôi đã xem bản tóm tắt dự án và muốn trao đổi thêm.\n`.slice(
      0,
      500,
    ),
  );
  return `mailto:?subject=${subject}&body=${body}`;
}
