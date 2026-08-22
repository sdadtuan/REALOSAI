import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BdsOrgSeedService, missingRequiredPositions } from '../org/bds-org-seed';
import { BdsTenantRepository } from './bds-tenant.repository';
import type { BdsTenantMode, BdsTenantRow, CreateBdsTenantBody } from './bds-tenant.types';

const MODES = new Set<BdsTenantMode>(['developer', 'broker', 'hybrid']);

function isTenantMode(value: unknown): value is BdsTenantMode {
  return typeof value === 'string' && MODES.has(value as BdsTenantMode);
}

@Injectable()
export class BdsTenantService {
  constructor(
    private readonly repo: BdsTenantRepository,
    private readonly seed: BdsOrgSeedService,
  ) {}

  async create(body: CreateBdsTenantBody): Promise<BdsTenantRow> {
    const code = String(body.code ?? '').trim();
    if (!code || !isTenantMode(body.mode)) {
      throw new BadRequestException();
    }
    const row = await this.repo.insert({
      code,
      name: body.name,
      mode: body.mode,
      operated_by_ptt: body.operated_by_ptt ?? false,
    });
    await this.seed.seedForTenant(row.id, body.mode);
    return row;
  }

  async getMe(tenantId: string): Promise<BdsTenantRow> {
    const id = String(tenantId ?? '').trim();
    if (!id) {
      throw new NotFoundException();
    }
    const row = await this.repo.getById(id);
    if (!row) {
      throw new NotFoundException();
    }
    return row;
  }

  async activate(id: string, assigned: string[]): Promise<BdsTenantRow> {
    if (missingRequiredPositions(assigned).length > 0) {
      throw new BadRequestException({ error: 'br_bds_34' });
    }
    return this.repo.setStatus(id, 'active');
  }
}
