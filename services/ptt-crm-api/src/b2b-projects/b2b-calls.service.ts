import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { shouldResolveArrivalAlert } from './b2b-alert-resolve.util';
import { B2bAlertsRepository } from './b2b-alerts.repository';
import { createB2bCpaasAdapter, type B2bCpaasAdapter } from './b2b-cpaas.adapter';
import { B2bCallsRepository } from './b2b-calls.repository';
import { B2bDncService } from './b2b-dnc.repository';
import { B2bCpaasDownError, B2bDncBlockedError, type StartCallResult } from './b2b-calls.types';

@Injectable()
export class B2bCallsService {
  private readonly adapter: B2bCpaasAdapter;

  constructor(
    private readonly repo: B2bCallsRepository,
    private readonly alertsRepo: B2bAlertsRepository,
    private readonly config: AppConfigService,
    private readonly dnc: B2bDncService,
  ) {
    this.adapter = createB2bCpaasAdapter(this.config);
  }

  private async assertCallAllowed(phone: string): Promise<void> {
    if (!this.config.b2bProjectOs) return;
    if (await this.dnc.isBlocked(phone)) {
      throw new B2bDncBlockedError();
    }
  }

  async startHumanCall(input: {
    leadId: number;
    staffId: number;
    phone: string;
  }): Promise<StartCallResult> {
    await this.assertCallAllowed(input.phone);
    const session = await this.repo.insertSession({
      leadId: input.leadId,
      staffId: input.staffId,
      kind: 'human',
      provider: this.config.b2bCpaas || 'mock',
      state: 'queued',
    });
    if (shouldResolveArrivalAlert('human')) {
      await this.alertsRepo.markAlertsHandled({
        leadId: input.leadId,
        staffId: input.staffId,
      });
    }
    try {
      const out = await this.adapter.startCall({
        phone: input.phone,
        sessionId: session.id,
        staffId: input.staffId,
        leadId: input.leadId,
      });
      await this.repo.attachProviderCallId(session.id, out.providerCallId);
      return { sessionId: session.id, providerCallId: out.providerCallId };
    } catch (err) {
      if (err instanceof B2bCpaasDownError) {
        throw err;
      }
      throw err;
    }
  }

  async startAiCall(input: { leadId: number; phone: string }): Promise<StartCallResult> {
    await this.assertCallAllowed(input.phone);
    const session = await this.repo.insertSession({
      leadId: input.leadId,
      staffId: null,
      kind: 'ai',
      provider: this.config.b2bCpaas || 'mock',
      state: 'queued',
    });
    const out = await this.adapter.startCall({
      phone: input.phone,
      sessionId: session.id,
      staffId: 0,
      leadId: input.leadId,
    });
    await this.repo.attachProviderCallId(session.id, out.providerCallId);
    return { sessionId: session.id, providerCallId: out.providerCallId };
  }

  async applyWebhook(input: { providerCallId: string; state: 'answered' | 'no_answer' | 'ended' | 'ringing' }): Promise<void> {
    const session = await this.repo.findByProviderCallId(input.providerCallId);
    if (!session) return;
    await this.repo.updateState({ sessionId: session.id, state: input.state });
    if (input.state === 'answered') {
      await this.repo.markLeadAnswered(session.leadId);
    }
  }

  async applyWebhookBySessionId(input: {
    sessionId: string;
    state: 'answered' | 'no_answer' | 'ended' | 'ringing';
    providerCallId?: string;
  }): Promise<void> {
    const session = await this.repo.findBySessionId(input.sessionId);
    if (!session) return;
    if (input.providerCallId) {
      await this.repo.attachProviderCallId(session.id, input.providerCallId);
    }
    await this.repo.updateState({ sessionId: session.id, state: input.state });
    if (input.state === 'answered') {
      await this.repo.markLeadAnswered(session.leadId);
    }
  }

  hasHumanDial(leadId: number): Promise<boolean> {
    return this.repo.hasHumanDial(leadId);
  }

  hasAiCall(leadId: number): Promise<boolean> {
    return this.repo.hasAiCall(leadId);
  }
}
