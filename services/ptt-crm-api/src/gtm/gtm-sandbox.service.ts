import { ConflictException, Injectable, NotFoundException, Inject, Optional } from '@nestjs/common';
import { toGtmDemoRequestView } from './gtm-view.util';
import {
  canGrantSandbox,
  oneTimePassword,
  sandboxExpiresAt,
  sandboxTenant,
  sandboxUsername,
} from './gtm-sandbox.util';
import { GTM_SANDBOX_MAILER, type GtmSandboxMailer } from './gtm-sandbox.mailer';
import { GTM_SANDBOX_STORE, type GtmSandboxStore } from './gtm-sandbox.store';
import { GtmRepository } from './gtm.repository';
import type { GtmDemoRequestView } from './gtm.types';

@Injectable()
export class GtmSandboxService {
  constructor(
    private readonly repo: GtmRepository,
    @Optional() @Inject(GTM_SANDBOX_MAILER) private readonly mailer?: GtmSandboxMailer,
    @Optional() @Inject(GTM_SANDBOX_STORE) private readonly store?: GtmSandboxStore,
  ) {}

  private get mailerImpl(): GtmSandboxMailer {
    return this.mailer ?? { sendSandboxCredential: async () => 'sent' as const };
  }

  async grantSandbox(id: string): Promise<GtmDemoRequestView> {
    const existing = await this.repo.getById(id);
    if (!existing) {
      throw new NotFoundException({ error: 'not_found' });
    }

    if (existing.status === 'sandbox_granted' && existing.sandbox_user_id) {
      const expiresAt = existing.sandbox_expires_at ? new Date(existing.sandbox_expires_at) : null;
      if (expiresAt && expiresAt > new Date()) {
        return toGtmDemoRequestView(existing);
      }
      throw new ConflictException({ error: 'sandbox_already_granted', expired: true });
    }

    if (!canGrantSandbox(existing.status)) {
      throw new ConflictException({ error: 'grant_not_allowed', status: existing.status });
    }

    const username = sandboxUsername(existing.id);
    const password = oneTimePassword();
    const expiresAt = sandboxExpiresAt(new Date());
    const tenant = sandboxTenant(existing.industry);
    const opsBase = (process.env.GTM_SANDBOX_OPS_BASE ?? 'https://rs.pttads.vn').replace(/\/$/, '');
    const boardUrl = `${opsBase}/sandbox/board/${existing.industry}`;

    this.store?.create({
      username,
      password,
      tenant,
      email: existing.email,
      disabled: false,
      expires_at: expiresAt.toISOString(),
    });

    const mailResult = await this.mailerImpl.sendSandboxCredential({
      to: existing.email,
      username,
      password,
      loginUrl: process.env.GTM_SANDBOX_LOGIN_URL?.trim() || 'https://rs.pttads.vn/login',
      expiresAt,
      industry: existing.industry,
      boardUrl,
    });

    if (mailResult === 'bounce') {
      this.store?.disable(username);
      const failed = await this.repo.patch(id, { status_note: 'sandbox_email_failed' });
      if (!failed) {
        throw new NotFoundException({ error: 'not_found' });
      }
      return toGtmDemoRequestView(failed);
    }

    const updated = await this.repo.patch(id, {
      status: 'sandbox_granted',
      sandbox_user_id: username,
      sandbox_expires_at: expiresAt,
    });

    if (!updated) {
      throw new NotFoundException({ error: 'not_found' });
    }

    return toGtmDemoRequestView(updated);
  }

  async expireSandboxes(now = new Date()): Promise<number> {
    const rows = await this.repo.listExpiredSandboxes(now);
    let count = 0;
    for (const row of rows) {
      if (row.sandbox_user_id && this.store?.disable(row.sandbox_user_id)) {
        count += 1;
      }
    }
    return count;
  }
}
