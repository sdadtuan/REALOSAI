import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { AdminAuditRepository } from '../admin-audit/admin-audit.repository';
import { AdminIntelligenceRepository } from './admin-intelligence.repository';
import type { CreateServiceAccountBody, ServiceAccountSummary } from './admin-intelligence.types';

const KEY_PREFIX = 'sa_live_';
const KEY_SECRET_BYTES = 32;

function hashServiceAccountKey(plaintext: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plaintext, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyServiceAccountKey(plaintext: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(plaintext, salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function generatePlaintextKey(): string {
  return `${KEY_PREFIX}${randomBytes(KEY_SECRET_BYTES).toString('base64url')}`;
}

@Injectable()
export class ServiceAccountService {
  constructor(
    private readonly repo: AdminIntelligenceRepository,
    private readonly adminAudit: AdminAuditRepository,
  ) {}

  async list(): Promise<{ service_accounts: ServiceAccountSummary[] }> {
    const service_accounts = await this.repo.listServiceAccounts();
    return { service_accounts };
  }

  async create(body: CreateServiceAccountBody, actorEmail: string): Promise<ServiceAccountSummary & { plaintext_key: string }> {
    const plaintextKey = generatePlaintextKey();
    const keyPrefix = plaintextKey.slice(0, 16);
    const keyHash = hashServiceAccountKey(plaintextKey);
    const account = await this.repo.insertServiceAccount({
      ...body,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      created_by: actorEmail,
    });
    await this.adminAudit.logSyntheticEvent({
      event_type: 'service_account_created',
      actor_email: actorEmail,
      category: 'service_account',
      severity: 'info',
      subject_label: account.name,
      subject_id: account.id,
      action: 'create',
      summary: `Service account created — ${account.name}`,
      diff_json: { key_prefix: keyPrefix },
    });
    return { ...account, plaintext_key: plaintextKey };
  }

  async rotate(id: string, actorEmail: string): Promise<{ plaintext_key: string; key_prefix: string }> {
    const existing = await this.repo.getServiceAccount(id);
    if (!existing) throw new NotFoundException({ error: 'service_account_not_found', id });
    const plaintextKey = generatePlaintextKey();
    const keyPrefix = plaintextKey.slice(0, 16);
    const keyHash = hashServiceAccountKey(plaintextKey);
    await this.repo.rotateServiceAccountKey(id, keyPrefix, keyHash);
    await this.adminAudit.logSyntheticEvent({
      event_type: 'service_account_rotated',
      actor_email: actorEmail,
      category: 'service_account',
      severity: 'warning',
      subject_label: existing.name,
      subject_id: id,
      action: 'rotate',
      summary: `Service account key rotated — ${existing.name}`,
      diff_json: { key_prefix: keyPrefix },
    });
    return { plaintext_key: plaintextKey, key_prefix: keyPrefix };
  }

  async revoke(id: string, actorEmail: string): Promise<{ ok: boolean }> {
    const existing = await this.repo.getServiceAccount(id);
    if (!existing) throw new NotFoundException({ error: 'service_account_not_found', id });
    await this.repo.revokeServiceAccount(id);
    await this.adminAudit.logSyntheticEvent({
      event_type: 'service_account_revoked',
      actor_email: actorEmail,
      category: 'service_account',
      severity: 'warning',
      subject_label: existing.name,
      subject_id: id,
      action: 'revoke',
      summary: `Service account revoked — ${existing.name}`,
      diff_json: {},
    });
    return { ok: true };
  }

  async validateBearerKey(authorization: string | undefined): Promise<ServiceAccountSummary | null> {
    const token = String(authorization ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!token.startsWith(KEY_PREFIX)) return null;
    const accounts = await this.repo.listServiceAccounts();
    for (const summary of accounts) {
      const full = await this.repo.getServiceAccount(summary.id);
      if (!full?.key_hash) continue;
      if (verifyServiceAccountKey(token, full.key_hash)) return summary;
    }
    return null;
  }
}
