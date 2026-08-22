import { Injectable, Logger } from '@nestjs/common';
import { parseWebhookJson } from '../webhooks/webhook-lead.mapper';
import { AppConfigService } from '../config/app-config.service';
import { B2bProjectsRepository } from './b2b-projects.repository';
import {
  parseZaloConversationEvents,
  resolveConversationProject,
} from './b2b-conversations.util';
import { B2bConversationsRepository } from './b2b-conversations.repository';

export interface B2bConversationThreadResponse {
  lead_id: number;
  thread_id: string | null;
  oa_id: string | null;
  messages: Array<{
    id: string;
    direction: 'inbound' | 'outbound';
    body: string;
    created_at: string;
  }>;
}

@Injectable()
export class B2bConversationsService {
  private readonly logger = new Logger(B2bConversationsService.name);

  constructor(
    private readonly repo: B2bConversationsRepository,
    private readonly projectsRepo: B2bProjectsRepository,
    private readonly config: AppConfigService,
  ) {}

  async ingestZaloWebhook(input: { rawBody: Buffer; projectSlug?: string }): Promise<number> {
    if (!this.config.b2bProjectOs || !input.projectSlug?.trim()) return 0;
    if (!(await this.repo.tablesReady())) return 0;

    const payload = parseWebhookJson(input.rawBody);
    const events = parseZaloConversationEvents(payload);
    if (!events.length) return 0;

    const catalog = await this.projectsRepo.loadIngressCatalog();
    let persisted = 0;

    for (const evt of events) {
      const resolved = resolveConversationProject({
        oaId: evt.oaId,
        projectSlug: input.projectSlug.trim().toLowerCase(),
        catalog,
      });
      if ('reason' in resolved) {
        this.logger.debug(`zalo thread skip reason=${resolved.reason} oa=${evt.oaId}`);
        continue;
      }
      const projectId = resolved.projectId;

      const leadId = await this.repo.findLeadByZaloUser(projectId, evt.userId);
      if (!leadId) continue;

      const threadId = await this.repo.upsertThread({
        leadId,
        projectId,
        oaId: evt.oaId,
        externalUserId: evt.userId,
      });
      await this.repo.insertMessage({
        threadId,
        direction: evt.direction,
        body: evt.body,
        providerMessageId: evt.providerMessageId,
      });
      persisted += 1;
    }

    return persisted;
  }

  async getLeadThread(leadId: number): Promise<B2bConversationThreadResponse> {
    const thread = await this.repo.getThreadByLeadId(leadId);
    if (!thread) {
      return { lead_id: leadId, thread_id: null, oa_id: null, messages: [] };
    }
    const messages = await this.repo.listMessages(thread.id);
    return {
      lead_id: leadId,
      thread_id: thread.id,
      oa_id: thread.oa_id,
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        created_at: m.created_at,
      })),
    };
  }

  async appendOutboundMessage(input: {
    leadId: number;
    body: string;
  }): Promise<B2bConversationThreadResponse> {
    const thread = await this.repo.getThreadByLeadId(input.leadId);
    if (!thread) {
      return { lead_id: input.leadId, thread_id: null, oa_id: null, messages: [] };
    }
    await this.repo.insertMessage({
      threadId: thread.id,
      direction: 'outbound',
      body: input.body.trim(),
    });
    return this.getLeadThread(input.leadId);
  }
}
