import { Injectable } from '@nestjs/common';
import { AnomalyDigestService } from './anomaly-digest.service';
import type { AnomalyDigestItem } from './channel-anomaly.types';

export interface CplDigestClientRow {
  client_id: string | null;
  channel: string;
  narrative: string;
  anomalies: AnomalyDigestItem[];
  severity: 'info' | 'warning' | 'critical';
}

export interface CplDigestResponse {
  ok: boolean;
  period: { days: number; from: string; to: string };
  narrative: string;
  clients: CplDigestClientRow[];
  summary: {
    cpl_spike_count: number;
    meta_open_alerts: number;
    zalo_open_alerts: number;
  };
  read_only: true;
  generated_at: string;
  request_id: string;
}

@Injectable()
export class CplAnomalyService {
  constructor(private readonly anomalyDigest: AnomalyDigestService) {}

  isEnabled(): boolean {
    return this.anomalyDigest.isEnabled();
  }

  async getWeeklyDigest(input: {
    client_id?: string;
    channel?: string;
    days?: number;
    actorId?: string | null;
    correlationId?: string;
  }): Promise<CplDigestResponse> {
    const days = Math.min(30, Math.max(1, Number(input.days ?? 7) || 7));
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    const requestId = input.correlationId?.trim() || `cpl-${Date.now()}`;

    const digestOut = await this.anomalyDigest.getDigest({
      client_id: input.client_id,
      channel: input.channel,
      days,
      actorId: input.actorId,
      correlationId: requestId,
    });

    const digest = digestOut.data.digest;
    const narrative =
      digest?.narrative ??
      (digestOut.data.enabled
        ? 'Không phát hiện anomaly CPL đáng kể trong kỳ.'
        : 'CPL digest tạm tắt (PTT_AI_ANOMALY_DIGEST_ENABLED).');

    const clients: CplDigestClientRow[] = [
      {
        client_id: digestOut.data.client_id,
        channel: String(digestOut.data.channel ?? 'all'),
        narrative,
        anomalies: digest?.anomalies ?? [],
        severity: digest?.severity ?? 'info',
      },
    ];

    return {
      ok: true,
      period: {
        days,
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      },
      narrative,
      clients,
      summary: {
        cpl_spike_count: digestOut.data.summary.cpl_spike_count,
        meta_open_alerts: digestOut.data.summary.meta_open_alerts,
        zalo_open_alerts: digestOut.data.summary.zalo_open_alerts,
      },
      read_only: true,
      generated_at: digestOut.data.generated_at,
      request_id: requestId,
    };
  }
}
