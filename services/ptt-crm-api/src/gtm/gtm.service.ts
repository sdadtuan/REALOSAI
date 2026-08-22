import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PgLeadsWriteRepository } from '../leads/pg-leads-write.repository';
import { hashGtmIp } from './gtm-ip.util';
import { pickRoundRobinOwner } from './gtm-owner.util';
import { canTransitionGtmStatus, type GtmStatus } from './gtm-status.util';
import { toGtmDemoRequestView } from './gtm-view.util';
import { isHoneypot, validatePublicDemoBody } from './gtm-validate.util';
import { GtmRepository } from './gtm.repository';
import type {
  CreatePublicDemoResponse,
  GtmDemoRequestView,
  GtmUtmFields,
  ListGtmDemoQuery,
  PatchGtmDemoBody,
} from './gtm.types';

const RATE_LIMIT_WINDOW_MS = 3600_000;
const RATE_LIMIT_MAX = 10;
const DEDUP_DAYS = 7;

function extractUtm(body: unknown): GtmUtmFields {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {};
  }
  const record = body as Record<string, unknown>;
  const pick = (key: keyof GtmUtmFields): string | null => {
    const value = record[key];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_content: pick('utm_content'),
    utm_term: pick('utm_term'),
  };
}

@Injectable()
export class GtmService {
  private readonly rateLimitHits = new Map<string, number[]>();

  constructor(
    private readonly repo: GtmRepository,
    private readonly leads: PgLeadsWriteRepository,
    private readonly config: AppConfigService,
  ) {}

  resetRateLimitsForTests(): void {
    this.rateLimitHits.clear();
  }

  isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return false;
    return this.config.gtmCorsOrigins.includes(origin);
  }

  async createPublic(body: unknown, ip: string): Promise<CreatePublicDemoResponse> {
    if (isHoneypot(body as { website?: string })) {
      return 'honeypot';
    }

    const validated = validatePublicDemoBody(body);
    if (!validated.ok) {
      return { field_errors: validated.field_errors };
    }

    const ipHash = hashGtmIp(ip, this.config.gtmIpSalt);
    if (this.isRateLimited(ipHash)) {
      return 'rate_limited';
    }
    this.recordRateLimitHit(ipHash);

    const since = new Date(Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000);
    const existingLeadId = await this.repo.findLeadIdByEmailSince(validated.value.email, since);
    const utm = extractUtm(body);
    const previousOwner = await this.repo.lastOwnerId();
    const ownerUserId = pickRoundRobinOwner(this.config.gtmSalesUserIds, previousOwner);

    let leadId = existingLeadId;
    let deduped = false;

    if (leadId) {
      deduped = true;
    } else {
      const lead = await this.leads.createLead({
        full_name: validated.value.full_name,
        email: validated.value.email,
        phone: validated.value.phone,
        source: 'pttcrm_web',
        channel: 'web',
        lead_flow_kind: 'b2b_prospect',
        meta: { company: validated.value.company },
      });
      leadId = String(lead.id);
    }

    const row = await this.repo.insert({
      ...validated.value,
      ...utm,
      ip_hash: ipHash,
      lead_id: leadId,
      owner_user_id: ownerUserId,
    });

    return { id: row.id, lead_id: leadId, deduped };
  }

  async listDemoRequests(query: ListGtmDemoQuery): Promise<{
    rows: GtmDemoRequestView[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const { rows, total } = await this.repo.list({ ...query, limit, offset });
    const now = new Date();
    return {
      rows: rows.map((row) => toGtmDemoRequestView(row, now)),
      total,
      limit,
      offset,
    };
  }

  async patchDemoRequest(id: string, body: PatchGtmDemoBody): Promise<GtmDemoRequestView> {
    const existing = await this.repo.getById(id);
    if (!existing) {
      throw new NotFoundException({ error: 'not_found' });
    }

    const nextStatus = body.status ?? existing.status;
    if (body.status && body.status !== existing.status) {
      if (!canTransitionGtmStatus(existing.status, body.status)) {
        throw new ConflictException({ error: 'invalid_transition', from: existing.status, to: body.status });
      }
    }

    if (nextStatus === 'qualified') {
      const note = body.status_note ?? existing.status_note ?? '';
      if (note.trim().length < 10) {
        throw new ConflictException({ error: 'status_note_required', min_length: 10 });
      }
    }

    const updated = await this.repo.patch(id, body);
    if (!updated) {
      throw new NotFoundException({ error: 'not_found' });
    }

    return toGtmDemoRequestView(updated);
  }

  private isRateLimited(ipHash: string): boolean {
    const now = Date.now();
    const hits = (this.rateLimitHits.get(ipHash) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    this.rateLimitHits.set(ipHash, hits);
    return hits.length >= RATE_LIMIT_MAX;
  }

  private recordRateLimitHit(ipHash: string): void {
    const now = Date.now();
    const hits = (this.rateLimitHits.get(ipHash) ?? []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    hits.push(now);
    this.rateLimitHits.set(ipHash, hits);
  }
}

export type { GtmStatus };
