import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertUnitTransition } from './bds-inventory-transition.util';
import {
  UNIT_POOLS,
  coerceUnitPool,
  type BdsUnitEvent,
  type BdsUnitPool,
  type ImportResult,
  type ImportUnitRow,
} from './bds-inventory.types';
import { BdsReProductPgRepository } from './bds-re-product-pg.repository';
import { parseUnitCsv } from './bds-unit-csv.util';

@Injectable()
export class BdsInventoryService {
  constructor(private readonly products: BdsReProductPgRepository) {}

  private optionalTenant(tenantId?: string): string | undefined {
    const t = String(tenantId ?? '').trim();
    return t || undefined;
  }

  private assertFiniteRowVersion(rowVersion: number): void {
    if (!Number.isFinite(rowVersion)) {
      throw new BadRequestException({ error: 'row_version' });
    }
  }

  private async assertProjectTenant(projectId: number, tenantId?: string): Promise<void> {
    const t = this.optionalTenant(tenantId);
    if (!t) return;
    const projectTenant = await this.products.resolveProjectTenantId(projectId);
    if (!projectTenant || projectTenant !== t) {
      throw new NotFoundException();
    }
  }

  private assertUnitTenant(row: Record<string, unknown>, tenantId?: string): void {
    const t = this.optionalTenant(tenantId);
    if (!t) return;
    if (row.tenant_id == null || String(row.tenant_id).trim() === '') return;
    if (String(row.tenant_id) !== t) {
      throw new NotFoundException();
    }
  }

  async getOrThrow(id: number, tenantId?: string): Promise<Record<string, unknown>> {
    const row = await this.products.getById(id);
    if (!row) throw new NotFoundException();
    this.assertUnitTenant(row, tenantId);
    return row;
  }

  async transition(id: number, event: BdsUnitEvent, expectedVersion: number, tenantId?: string) {
    const row = await this.getOrThrow(id, tenantId);
    let next;
    try {
      next = assertUnitTransition(String(row.status), event);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
    const ok = await this.products.transitionOptimistic(id, expectedVersion, next);
    if (!ok) throw new ConflictException({ error: 'unit_locked' });
    return this.getOrThrow(id, tenantId);
  }

  async lock(id: number, expectedVersion: number, reason: string, tenantId?: string) {
    this.assertFiniteRowVersion(expectedVersion);
    const trimmed = String(reason ?? '').trim();
    if (trimmed.length < 3) {
      throw new BadRequestException({ error: 'reason' });
    }
    const result = await this.transition(id, 'cdt_lock', expectedVersion, tenantId);
    await this.products.setLockNoteIfEmpty(id, `[lock] ${trimmed}`);
    return result;
  }

  async unlock(id: number, expectedVersion: number, tenantId?: string) {
    this.assertFiniteRowVersion(expectedVersion);
    return this.transition(id, 'unlock', expectedVersion, tenantId);
  }

  async setPool(id: number, pool: string, expectedVersion: number, tenantId?: string) {
    this.assertFiniteRowVersion(expectedVersion);
    if (!(UNIT_POOLS as readonly string[]).includes(pool)) {
      throw new BadRequestException({ error: 'pool' });
    }
    await this.getOrThrow(id, tenantId);
    const ok = await this.products.updatePool(id, pool as BdsUnitPool, expectedVersion);
    if (!ok) throw new ConflictException({ error: 'unit_locked' });
    return this.getOrThrow(id, tenantId);
  }

  async importCsv(projectId: number, csv: string, tenantId?: string): Promise<ImportResult> {
    await this.assertProjectTenant(projectId, tenantId);
    let rows: ImportUnitRow[];
    try {
      rows = parseUnitCsv(csv);
    } catch (e) {
      throw new BadRequestException({ error: String((e as Error).message) });
    }
    const conflicts: Array<{ unit_code: string; error: string }> = [];
    const skipped_sold: Array<{ unit_code: string; reason: 'sold' }> = [];
    const seen = new Set<string>();
    const pending: ImportUnitRow[] = [];

    for (const row of rows) {
      const code = String(row.unit_code ?? '').trim();
      if (!code) {
        conflicts.push({ unit_code: '', error: 'unit_code_required' });
        continue;
      }
      const key = code.toLowerCase();
      if (seen.has(key)) {
        conflicts.push({ unit_code: code, error: 'duplicate_unit_code' });
        continue;
      }
      seen.add(key);
      const existing = await this.products.findByUnitCode(projectId, code);
      if (existing && String(existing.status) === 'sold') {
        skipped_sold.push({ unit_code: code, reason: 'sold' });
        continue;
      }
      if (existing) {
        conflicts.push({ unit_code: code, error: 'duplicate_unit_code' });
        continue;
      }
      const st = String(row.status ?? 'available').trim() || 'available';
      if (st !== 'available' && st !== 'locked') {
        conflicts.push({ unit_code: code, error: 'illegal_import_status' });
        continue;
      }
      pending.push({ ...row, unit_code: code, status: st });
    }

    if (conflicts.length) {
      throw new ConflictException({ error: 'import_conflict', conflicts, skipped_sold });
    }

    const insertTenantId = await this.products.resolveProjectTenantId(projectId);
    for (const row of pending) {
      const id = await this.products.nextId();
      await this.products.insertImported({
        id,
        project_id: projectId,
        tenant_id: insertTenantId,
        unit_code: row.unit_code,
        tower: String(row.tower ?? ''),
        floor: String(row.floor ?? ''),
        zone: String(row.zone ?? ''),
        product_line: String(row.product_line ?? ''),
        pool: coerceUnitPool(row.pool),
        status: (row.status as 'available' | 'locked') ?? 'available',
        list_price_vnd: Number(row.list_price_vnd ?? 0) || 0,
        net_price_vnd: Number(row.net_price_vnd ?? 0) || 0,
        area_m2: row.area_m2 ? Number(row.area_m2) : null,
        bedrooms: row.bedrooms ? Number(row.bedrooms) : null,
      });
    }
    return { imported: pending.length, skipped_sold, conflicts: [] };
  }

  async listUnits(projectId: number, tenantId?: string) {
    await this.assertProjectTenant(projectId, tenantId);
    return { units: await this.products.listByProject(projectId) };
  }

  async stack(projectId: number, tenantId?: string) {
    await this.assertProjectTenant(projectId, tenantId);
    const units = await this.products.listByProject(projectId);
    const towers = new Map<string, Map<string, Record<string, unknown>[]>>();
    for (const u of units) {
      const tw = String(u.tower ?? '') || '—';
      const fl = String(u.floor ?? '') || '—';
      if (!towers.has(tw)) towers.set(tw, new Map());
      const floors = towers.get(tw)!;
      if (!floors.has(fl)) floors.set(fl, []);
      floors.get(fl)!.push(u);
    }
    return {
      project_id: projectId,
      towers: [...towers.entries()].map(([tower, floors]) => ({
        tower,
        floors: [...floors.entries()].map(([floor, rows]) => ({ floor, units: rows })),
      })),
    };
  }
}
