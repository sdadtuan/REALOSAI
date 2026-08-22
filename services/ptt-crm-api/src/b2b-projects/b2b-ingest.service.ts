import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import type { NormalizedLeadPayload } from '../webhooks/webhook-lead.types';
import { PTT_OPERATING_COMPANY_ID } from './b2b-projects.constants';
import { B2bProjectsRepository } from './b2b-projects.repository';
import {
  extractIngressKeysFromLead,
  resolveIngressProject,
  webhookChannelToIngress,
  type IngressChannel,
} from './b2b-ingest.util';

export interface B2bPreparedLead extends NormalizedLeadPayload {
  b2b_project_id?: string;
  owner_company_id?: string;
  lead_flow_kind?: 'b2b_prospect';
}

export interface PrepareWebhookLeadsResult {
  toEnqueue: B2bPreparedLead[];
  unmatchedCount: number;
  enqueuedCount: number;
}

@Injectable()
export class B2bIngestService {
  constructor(
    private readonly repo: B2bProjectsRepository,
    private readonly config: AppConfigService,
  ) {}

  isActive(): boolean {
    return this.config.b2bProjectOs;
  }

  async prepareWebhookLeads(input: {
    channel: string;
    projectSlug?: string;
    leads: NormalizedLeadPayload[];
  }): Promise<PrepareWebhookLeadsResult> {
    if (!this.config.b2bProjectOs || !input.projectSlug?.trim()) {
      return {
        toEnqueue: input.leads,
        unmatchedCount: 0,
        enqueuedCount: input.leads.length,
      };
    }

    const ingressChannel = webhookChannelToIngress(input.channel);
    if (!ingressChannel) {
      return {
        toEnqueue: input.leads,
        unmatchedCount: 0,
        enqueuedCount: input.leads.length,
      };
    }

    const catalog = await this.repo.loadIngressCatalog();
    const projectSlug = input.projectSlug.trim().toLowerCase();
    const toEnqueue: B2bPreparedLead[] = [];
    let unmatchedCount = 0;

    for (const lead of input.leads) {
      const keys = extractIngressKeysFromLead(input.channel, lead);
      const resolved = resolveIngressProject(
        {
          channel: ingressChannel,
          projectSlug,
          formId: keys.formId,
          pageId: keys.pageId,
          oaId: keys.oaId,
          webformSlug: keys.webformSlug,
        },
        catalog,
      );

      if ('unmatched' in resolved) {
        unmatchedCount += 1;
        await this.repo.insertUnmatchedIngress({
          channel: ingressChannel,
          projectSlug,
          externalKey: keys.formId ?? keys.oaId ?? keys.webformSlug ?? lead.external_lead_id,
          payload: {
            reason: resolved.reason,
            external_lead_id: lead.external_lead_id,
            form_id: keys.formId,
            oa_id: keys.oaId,
          },
        });
        continue;
      }

      toEnqueue.push({
        ...lead,
        client_id: '',
        b2b_project_id: resolved.projectId,
        owner_company_id: PTT_OPERATING_COMPANY_ID,
        lead_flow_kind: 'b2b_prospect',
      });
    }

    return { toEnqueue, unmatchedCount, enqueuedCount: toEnqueue.length };
  }

  mapApiIngressChannel(channelType: string): IngressChannel | null {
    return webhookChannelToIngress(channelType);
  }
}
