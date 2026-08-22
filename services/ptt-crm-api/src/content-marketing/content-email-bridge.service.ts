import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailMarketingService } from '../email-marketing/email-marketing.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktBridgeEmailStatus, CmktEmBridgeRef, CmktItemRow } from './content-marketing.types';

const EMAIL_BRIDGE_STATUSES = new Set([
  'approved_internal',
  'scheduled',
  'published',
  'pending_client',
  'client_approved',
]);

@Injectable()
export class ContentEmailBridgeService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly email: EmailMarketingService,
    private readonly lifecycle: ServiceLifecycleService,
  ) {}

  private assertEmailEligible(item: CmktItemRow): void {
    if (!['newsletter', 'drip'].includes(item.channel) || item.format !== 'email') {
      throw new BadRequestException({
        error: 'email_bridge_ineligible',
        message: 'Email bridge chỉ áp dụng newsletter/drip + email.',
      });
    }
    if (!EMAIL_BRIDGE_STATUSES.has(item.status)) {
      throw new BadRequestException({
        error: 'email_bridge_status',
        message: 'Item phải được duyệt nội bộ trước khi bridge Email.',
        status: item.status,
      });
    }
  }

  private readEmBridge(item: CmktItemRow): CmktEmBridgeRef | null {
    const ref = item.brief_json?.em_bridge;
    if (!ref || typeof ref !== 'object') return null;
    const campaignId = String((ref as CmktEmBridgeRef).campaign_id ?? '').trim();
    if (!campaignId) return null;
    return ref as CmktEmBridgeRef;
  }

  async bridgeEmail(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<{ ok: boolean; item: CmktItemRow; campaign_id: string; href: string }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    this.assertEmailEligible(item);

    const existing = this.readEmBridge(item);
    if (existing?.campaign_id) {
      return {
        ok: true,
        item,
        campaign_id: existing.campaign_id,
        href: existing.href ?? `/email/campaigns/${existing.campaign_id}`,
      };
    }

    const clientIdFromBody = String(body.client_id ?? '').trim();
    let clientId = clientIdFromBody;
    if (!clientId) {
      try {
        const lcCtx = await this.lifecycle.context(lifecycleId);
        clientId = String(lcCtx.contract?.agency_client_id ?? '').trim();
      } catch {
        clientId = '';
      }
    }
    if (!clientId) {
      throw new BadRequestException({
        error: 'email_client_not_linked',
        message:
          'Lifecycle chưa liên kết agency client — gán agency_client_id trên hợp đồng hoặc truyền client_id.',
      });
    }

    let templateId = String(body.template_id ?? '').trim();
    if (!templateId) {
      const templates = await this.email.listTemplates({ clientId, limit: 1, offset: 0 });
      templateId = templates.items[0]?.id ?? '';
    }
    if (!templateId) {
      throw new BadRequestException({
        error: 'email_template_required',
        message: 'Client cần ít nhất 1 template hoặc truyền template_id.',
      });
    }

    const emailType = String(body.email_type ?? (item.channel === 'drip' ? 'journey' : 'broadcast')).trim();
    const campaign = await this.email.createCampaign({
      clientId,
      name: item.title,
      templateId,
      segmentId: body.segment_id != null ? String(body.segment_id) : undefined,
      campaignType: emailType === 'journey' ? 'journey' : 'broadcast',
      actor: actorEmail,
    });

    const emBridge: CmktEmBridgeRef = {
      campaign_id: campaign.id,
      status: campaign.status,
      campaign_type: campaign.campaign_type,
      href: `/email/campaigns/${campaign.id}`,
    };

    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      email_bridge_id: 1,
      brief_json: { ...item.brief_json, em_bridge: emBridge },
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'email_bridge');

    return {
      ok: true,
      item: updated,
      campaign_id: campaign.id,
      href: emBridge.href ?? `/email/campaigns/${campaign.id}`,
    };
  }

  async getEmailBridgeStatus(
    lifecycleId: number,
    itemId: number,
  ): Promise<CmktBridgeEmailStatus> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    const ref = this.readEmBridge(item);
    if (!ref) {
      return { linked: false, campaign_id: null, status: null, href: null };
    }
    return {
      linked: true,
      campaign_id: ref.campaign_id,
      status: ref.status,
      href: ref.href ?? `/email/campaigns/${ref.campaign_id}`,
    };
  }
}
