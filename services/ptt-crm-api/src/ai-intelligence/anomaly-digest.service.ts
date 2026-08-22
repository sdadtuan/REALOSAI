import { Injectable } from '@nestjs/common';
import { MetaAlertsRepository } from '../meta-alerts/meta-alerts.repository';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import {
  buildAnomalyDigestSnapshot,
  summarizeCoachFields,
} from './channel-anomaly.engine';
import {
  AlertDigestSummary,
  AnomalyDigestQuery,
  AnomalyDigestResponse,
  ChannelAnomalyChannel,
  ChannelAnomalyCoachFields,
} from './channel-anomaly.types';

@Injectable()
export class AnomalyDigestService {
  constructor(
    private readonly metaAlerts: MetaAlertsRepository,
    private readonly audit: AiAuditService,
  ) {}

  isEnabled(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
      (process.env.PTT_AI_ANOMALY_DIGEST_ENABLED ?? '1').trim().toLowerCase(),
    );
  }

  private normalizeChannel(raw: string | undefined): ChannelAnomalyChannel | 'all' {
    const value = String(raw ?? 'all').trim().toLowerCase();
    if (value === 'meta' || value === 'zalo') {
      return value;
    }
    return 'all';
  }

  private normalizeDays(raw: number | undefined): number {
    const parsed = Number(raw ?? 7);
    if (!Number.isFinite(parsed)) return 7;
    return Math.min(30, Math.max(1, Math.trunc(parsed)));
  }

  async loadSummary(clientId?: string, days = 7): Promise<AlertDigestSummary | null> {
    if (!(await this.metaAlerts.pgMetaAlertsReady())) {
      return null;
    }
    return this.metaAlerts.summarizeOpenAlerts({
      clientId: clientId?.trim() || undefined,
      sinceDays: days,
      limit: 25,
    });
  }

  async buildCoachFields(days = 7): Promise<ChannelAnomalyCoachFields> {
    if (!this.isEnabled()) {
      return this.emptyCoachFields();
    }
    const summary = await this.loadSummary(undefined, days);
    if (!summary) {
      return this.emptyCoachFields();
    }
    return summarizeCoachFields(summary);
  }

  emptyCoachFields(): ChannelAnomalyCoachFields {
    return {
      meta_open_alerts: 0,
      zalo_open_alerts: 0,
      cpl_spike_count: 0,
      zero_leads_24h_count: 0,
      roas_low_count: 0,
      spend_spike_count: 0,
      top_anomaly_message: null,
      top_anomaly_channel: null,
      top_anomaly_campaign_id: null,
    };
  }

  async getDigest(input: AnomalyDigestQuery = {}): Promise<AnomalyDigestResponse> {
    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const channel = this.normalizeChannel(input.channel);
    const days = this.normalizeDays(input.days);
    const clientId = input.client_id?.trim() || null;

    if (!this.isEnabled()) {
      return {
        data: {
          enabled: false,
          client_id: clientId,
          channel,
          days,
          digest: null,
          summary: this.emptyCoachFields(),
          generated_at: generatedAt,
        },
        meta: { request_id: requestId },
        errors: [],
      };
    }

    const summary = await this.loadSummary(clientId ?? undefined, days);
    if (!summary) {
      return {
        data: {
          enabled: true,
          client_id: clientId,
          channel,
          days,
          digest: null,
          summary: this.emptyCoachFields(),
          generated_at: generatedAt,
          error: 'meta_alerts_not_ready',
        },
        meta: { request_id: requestId },
        errors: [],
      };
    }

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.CHANNEL_ANOMALY_DIGEST,
        entityType: clientId ? 'client' : 'org',
        entityId: clientId ?? 'org',
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'channel-anomaly-digest-v1',
        input: { client_id: clientId, channel, days },
      },
      async () => {
        const digest = buildAnomalyDigestSnapshot({
          summary,
          channel,
          clientId,
        });
        return {
          data: digest,
          output: {
            open_alerts: summary.meta_open_alerts + summary.zalo_open_alerts,
            anomaly_count: digest.anomalies.length,
          },
        };
      },
    );

    return {
      data: {
        enabled: true,
        client_id: clientId,
        channel,
        days,
        digest: wrapped.data,
        summary: summarizeCoachFields(summary),
        agent_run_id: wrapped.runId,
        generated_at: generatedAt,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
