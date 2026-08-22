import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { outcomeWonFromStatus } from './b2b-routing-ab.util';
import { hashPhoneForCapi } from './b2b-dnc.util';
import { B2bAdsCapiRepository } from './b2b-ads-capi.repository';

export type CapiDispatchFn = (input: {
  channel: string;
  campaignId: string | null;
  hashedPhone: string | null;
  leadId: number;
}) => Promise<{ ok: boolean; error?: string }>;

@Injectable()
export class B2bAdsCapiService {
  private readonly logger = new Logger(B2bAdsCapiService.name);
  private dispatchFn: CapiDispatchFn | null = null;

  constructor(
    private readonly repo: B2bAdsCapiRepository,
    private readonly config: AppConfigService,
  ) {}

  setDispatchFn(fn: CapiDispatchFn | null): void {
    this.dispatchFn = fn;
  }

  async recordStatusOutcome(input: { leadId: number; status: string }): Promise<boolean> {
    if (!this.config.b2bProjectOs || !this.config.b2bAdsCapi) return false;
    const won = outcomeWonFromStatus(input.status);
    if (won !== true) return false;
    if (!(await this.repo.tableReady())) return false;

    const ctx = await this.repo.loadLeadConversionContext(input.leadId);
    if (!ctx) return false;

    const channel = String(ctx.channel ?? 'meta').trim().toLowerCase() || 'meta';
    const hashedPhone = hashPhoneForCapi(ctx.phone);

    if (!this.dispatchFn) {
      await this.repo.insertLog({
        leadId: input.leadId,
        channel,
        campaignId: ctx.campaignId,
        hashedPhone,
        status: 'skipped_no_dispatch',
      });
      return false;
    }

    try {
      const out = await Promise.race([
        this.dispatchFn({
          channel,
          campaignId: ctx.campaignId,
          hashedPhone,
          leadId: input.leadId,
        }),
        new Promise<{ ok: false; error: string }>((resolve) =>
          setTimeout(() => resolve({ ok: false, error: 'timeout_2s' }), 2000),
        ),
      ]);
      await this.repo.insertLog({
        leadId: input.leadId,
        channel,
        campaignId: ctx.campaignId,
        hashedPhone,
        status: out.ok ? 'sent' : 'failed',
        error: out.error ?? null,
      });
      return out.ok;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'dispatch_error';
      this.logger.warn(`ads capi failed lead=${input.leadId}: ${message}`);
      await this.repo.insertLog({
        leadId: input.leadId,
        channel,
        campaignId: ctx.campaignId,
        hashedPhone,
        status: 'failed',
        error: message,
      });
      return false;
    }
  }
}
