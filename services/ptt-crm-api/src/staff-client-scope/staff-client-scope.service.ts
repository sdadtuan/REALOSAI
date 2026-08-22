import { Injectable, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  assertClientInScope,
  isClientScopeRestricted,
  normalizeClientIds,
} from './staff-client-scope.util';
import { StaffUserClientsRepository } from './staff-user-clients.repository';
import { Pool } from 'pg';

export type ClientScopeContext = {
  restricted: boolean;
  allowedClientIds: string[];
};

@Injectable()
export class StaffClientScopeService {
  private residencyPool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
    private readonly userClients: StaffUserClientsRepository,
  ) {}

  private get residencyDb(): Pool {
    if (!this.residencyPool) {
      this.residencyPool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.residencyPool;
  }

  private async loadResidencyAllowedTags(userId: string): Promise<string[] | null> {
    try {
      const result = await this.residencyDb.query<{ allowed_tags: string[] }>(
        `SELECT allowed_tags FROM staff_user_residency_rules WHERE user_id = $1::uuid LIMIT 1`,
        [userId.trim()],
      );
      const row = result.rows[0];
      if (!row) return null;
      return Array.isArray(row.allowed_tags) ? row.allowed_tags.map(String) : null;
    } catch {
      return null;
    }
  }

  private async filterClientIdsByResidency(clientIds: string[], allowedTags: string[]): Promise<string[]> {
    if (!clientIds.length || !allowedTags.length) return clientIds;
    try {
      const result = await this.residencyDb.query<{ id: string }>(
        `SELECT id::text FROM clients
         WHERE id = ANY($1::uuid[])
           AND (data_residency_tag IS NULL OR data_residency_tag = ANY($2::text[]))`,
        [clientIds, allowedTags],
      );
      return normalizeClientIds(result.rows.map((r) => String(r.id)));
    } catch {
      return clientIds;
    }
  }

  private async applyResidencyFilter(userId: string, clientIds: string[]): Promise<string[]> {
    const allowedTags = await this.loadResidencyAllowedTags(userId);
    if (!allowedTags?.length) return clientIds;
    return this.filterClientIdsByResidency(clientIds, allowedTags);
  }

  pilotEnabled(): boolean {
    return this.config.staffScopePilotEnabled;
  }

  async loadClientIdsForUser(userId: string, positionCode?: string | null): Promise<string[] | undefined> {
    if (!this.pilotEnabled()) return undefined;
    if (positionCode && this.staffAuth.isSuperAdminPosition(positionCode)) return undefined;
    let ids = await this.userClients.loadClientIdsForUser(userId);
    ids = await this.applyResidencyFilter(userId, ids);
    return ids.length ? ids : undefined;
  }

  async resolveForJwt(userId: string, positionId: number): Promise<string[] | undefined> {
    if (!this.pilotEnabled()) return undefined;
    const positionCode = await this.staffAuth.loadPositionCodePublic(positionId);
    return this.loadClientIdsForUser(userId, positionCode);
  }

  async resolveForRequest(
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ): Promise<ClientScopeContext> {
    if (!this.pilotEnabled() || req.staffAuthVia === 'internal' || !req.staffUser) {
      return { restricted: false, allowedClientIds: [] };
    }

    let clientIds = req.staffUser.client_ids;
    let positionCode: string | null | undefined;
    if (clientIds == null) {
      const me = await this.staffAuth.me(req.staffUser);
      clientIds = me.client_ids;
      positionCode = me.position_code;
    } else {
      positionCode = await this.staffAuth.loadPositionCodePublic(req.staffUser.position_id);
    }

    const allowedClientIds = normalizeClientIds(clientIds);
    const restricted = isClientScopeRestricted(this.pilotEnabled(), positionCode, allowedClientIds);
    return { restricted, allowedClientIds };
  }

  assertListClientFilter(scope: ClientScopeContext, requestedClientId?: string): void {
    if (!scope.restricted) return;
    if (requestedClientId?.trim() && !assertClientInScope(requestedClientId, scope.allowedClientIds)) {
      throw new ForbiddenException({ error: 'client_scope_denied', client_id: requestedClientId.trim() });
    }
  }

  assertLeadAccessible(scope: ClientScopeContext, leadClientId: string | null | undefined): void {
    if (!scope.restricted) return;
    if (!assertClientInScope(leadClientId, scope.allowedClientIds)) {
      throw new ForbiddenException({ error: 'client_scope_denied' });
    }
  }

  assertClientAccessible(scope: ClientScopeContext, clientId: string | null | undefined): void {
    if (!scope.restricted) return;
    const normalized = String(clientId ?? '').trim();
    if (!normalized) {
      throw new ForbiddenException({ error: 'client_scope_denied', message: 'client_id required' });
    }
    if (!assertClientInScope(normalized, scope.allowedClientIds)) {
      throw new ForbiddenException({ error: 'client_scope_denied', client_id: normalized });
    }
  }

  allowedClientIdsForList(scope: ClientScopeContext): string[] | undefined {
    if (!scope.restricted) return undefined;
    return scope.allowedClientIds;
  }
}
