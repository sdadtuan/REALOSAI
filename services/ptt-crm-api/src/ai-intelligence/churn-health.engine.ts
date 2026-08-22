import { computeRenewalHealth } from './renewal.engine';
import { RenewalContractCandidate } from './renewal.types';
import {
  ChurnHealthContext,
  ChurnHealthSnapshot,
  ChurnHealthSignals,
  ChurnRiskLevel,
} from './churn-health.types';
import { LeadScoreFactor } from './lead-score.types';

const RENEWAL_SCORE_THRESHOLD = 55;

function healthScoreToRisk(score: number): ChurnRiskLevel {
  if (score >= 70) return 'low';
  if (score >= 55) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

function emptySignals(): ChurnHealthSignals {
  return {
    contract_days_until_end: null,
    contract_amount_vnd: 0,
    lifecycle_id: null,
    tickets_open: 0,
    tickets_last_7d: 0,
    tickets_prev_7d: 0,
    ticket_spike: false,
    negative_tickets_open: 0,
    payment_overdue_vnd: 0,
    payment_overdue_count: 0,
  };
}

export function computeTicketSpike(last7d: number, prev7d: number): boolean {
  if (last7d < 2) return false;
  const baseline = Math.max(prev7d, 1);
  return last7d >= baseline * 2;
}

export function computeChurnHealth(context: ChurnHealthContext): ChurnHealthSnapshot {
  const signals = context.signals ?? emptySignals();
  const factors: LeadScoreFactor[] = [];
  let score = 78;

  if (signals.contract_days_until_end != null) {
    const renewalCandidate: RenewalContractCandidate = {
      contract_id: 0,
      agency_client_id: context.client_id,
      client_name: context.client_name,
      contract_title: '',
      ends_on: '',
      amount_vnd: signals.contract_amount_vnd,
      days_until_end: signals.contract_days_until_end,
      trigger_window: signals.contract_days_until_end <= 30 ? 30 : signals.contract_days_until_end <= 60 ? 60 : 90,
      lifecycle_id: signals.lifecycle_id,
    };
    const renewalHealth = computeRenewalHealth(renewalCandidate);
    const renewalDelta = 72 - renewalHealth.health_score;
    if (renewalDelta > 0) {
      score -= renewalDelta;
      for (const factor of renewalHealth.factors) {
        if (factor.sign === '-') {
          factors.push({ ...factor, key: `contract_${factor.key}` });
        }
      }
    }
  }

  if (signals.ticket_spike) {
    score -= 15;
    factors.push({
      key: 'ticket_spike',
      label: '− Ticket tăng đột biến 7 ngày',
      delta: 15,
      sign: '-',
    });
  } else if (signals.tickets_open >= 3) {
    score -= 8;
    factors.push({
      key: 'tickets_open',
      label: '− Nhiều ticket đang mở',
      delta: 8,
      sign: '-',
    });
  }

  if (signals.negative_tickets_open >= 2) {
    score -= 10;
    factors.push({
      key: 'sentiment_negative',
      label: '− Sentiment CS kém (ticket ưu tiên cao)',
      delta: 10,
      sign: '-',
    });
  } else if (signals.negative_tickets_open === 1) {
    score -= 5;
    factors.push({
      key: 'sentiment_watch',
      label: '− Ticket phản ánh chưa xử lý',
      delta: 5,
      sign: '-',
    });
  }

  if (signals.payment_overdue_vnd > 5_000_000) {
    score -= 12;
    factors.push({
      key: 'payment_overdue_high',
      label: '− Trễ thanh toán lớn',
      delta: 12,
      sign: '-',
    });
  } else if (signals.payment_overdue_vnd > 0) {
    score -= 6;
    factors.push({
      key: 'payment_overdue',
      label: '− Trễ thanh toán',
      delta: 6,
      sign: '-',
    });
  }

  if (signals.payment_overdue_count >= 2) {
    score -= 5;
    factors.push({
      key: 'payment_overdue_repeat',
      label: '− Nhiều khoản quá hạn',
      delta: 5,
      sign: '-',
    });
  }

  if (factors.filter((f) => f.sign === '-').length === 0) {
    factors.push({
      key: 'stable',
      label: '+ Tín hiệu CS ổn định',
      delta: 4,
      sign: '+',
    });
    score += 4;
  }

  score = Math.min(100, Math.max(0, score));
  const churnRiskPct = Math.round((100 - score) * 10) / 10;

  let healthBand: ChurnHealthSnapshot['health_band'] = 'healthy';
  if (score < 40) healthBand = 'critical';
  else if (score < 55) healthBand = 'at_risk';
  else if (score < 70) healthBand = 'watch';

  const riskLevel = healthScoreToRisk(score);

  return {
    health_score: score,
    health_band: healthBand,
    churn_risk_pct: churnRiskPct,
    risk_level: riskLevel,
    ticket_spike: signals.ticket_spike,
    factors,
    signals,
    renewal_recommended: score < RENEWAL_SCORE_THRESHOLD,
  };
}
