import {
  RenewalChannel,
  RenewalContractCandidate,
  RenewalHealthSnapshot,
  RenewalRiskLevel,
  RenewalTriggerWindow,
} from './renewal.types';
import { LeadScoreFactor } from './lead-score.types';

function formatVnd(amount: number): string {
  return Math.round(amount).toLocaleString('vi-VN');
}

export function computeRenewalHealth(candidate: RenewalContractCandidate): RenewalHealthSnapshot {
  const factors: LeadScoreFactor[] = [];
  let score = 72;

  if (candidate.days_until_end <= 30) {
    score -= 18;
    factors.push({
      key: 'expiry_30d',
      label: '− HĐ hết hạn ≤30 ngày',
      delta: 18,
      sign: '-',
    });
  } else if (candidate.days_until_end <= 60) {
    score -= 10;
    factors.push({
      key: 'expiry_60d',
      label: '− HĐ hết hạn ≤60 ngày',
      delta: 10,
      sign: '-',
    });
  } else {
    factors.push({
      key: 'expiry_90d',
      label: '+ Còn thời gian chuẩn bị T-90',
      delta: 6,
      sign: '+',
    });
    score += 6;
  }

  if (candidate.amount_vnd >= 100_000_000) {
    score += 8;
    factors.push({ key: 'contract_high_value', label: '+ HĐ giá trị cao', delta: 8, sign: '+' });
  } else if (candidate.amount_vnd >= 30_000_000) {
    score += 4;
    factors.push({ key: 'contract_mid_value', label: '+ HĐ giá trị trung bình', delta: 4, sign: '+' });
  }

  if (candidate.lifecycle_id) {
    score += 5;
    factors.push({ key: 'lifecycle_active', label: '+ Có lifecycle triển khai', delta: 5, sign: '+' });
  }

  score = Math.min(100, Math.max(0, score));
  const churnRiskPct = Math.round((100 - score) * 10) / 10;

  let healthBand: RenewalHealthSnapshot['health_band'] = 'healthy';
  if (score < 40) healthBand = 'critical';
  else if (score < 55) healthBand = 'at_risk';
  else if (score < 70) healthBand = 'watch';

  const riskLevel = healthScoreToRisk(score);

  return {
    health_score: score,
    health_band: healthBand,
    churn_risk_pct: churnRiskPct,
    risk_level: riskLevel,
    factors,
  };
}

function healthScoreToRisk(score: number): RenewalRiskLevel {
  if (score >= 70) return 'low';
  if (score >= 55) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

export function buildRenewalDraft(
  candidate: RenewalContractCandidate,
  channel: RenewalChannel,
  clientDisplayName?: string,
): string {
  const name = clientDisplayName?.trim() || candidate.client_name || 'Quý khách';
  const amount = formatVnd(candidate.amount_vnd);
  const ends = candidate.ends_on;
  const days = candidate.days_until_end;
  const title = candidate.contract_title || 'Hợp đồng dịch vụ';

  if (channel === 'zalo') {
    return [
      `Chào ${name},`,
      `HĐ "${title}" sắp hết hạn ${ends} (còn ${days} ngày).`,
      `PTT Ads đề xuất gia hạn — tham chiếu ${amount} VND.`,
      'AM sẽ liên hệ chi tiết. Trân trọng!',
    ].join('\n');
  }

  return [
    `Kính gửi ${name},`,
    '',
    `Hợp đồng "${title}" sắp đến hạn ngày ${ends} (còn ${days} ngày).`,
    `Chúng tôi đề xuất gia hạn tiếp tục gói dịch vụ agency hiện tại với giá trị tham chiếu ${amount} VND.`,
    '',
    'Rất mong được trao đổi thêm về kế hoạch renewal trong tuần này.',
    '',
    'Trân trọng,',
    'Account Manager · PTT Ads',
  ].join('\n');
}

export function windowMatches(candidate: RenewalContractCandidate, windows: RenewalTriggerWindow[]): boolean {
  return windows.includes(candidate.trigger_window);
}
