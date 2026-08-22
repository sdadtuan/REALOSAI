import { Injectable, NotFoundException } from '@nestjs/common';
import { isBdsAgencyEnabled } from '../bds.flags';
import { BdsAgencyRepository } from '../agencies/bds-agency.repository';
import { BdsReProductPgRepository } from '../inventory/bds-re-product-pg.repository';
import { BdsBuyerLeadRepository } from './bds-buyer-lead.repository';
import type { MatchRow } from './bds-buyer.types';
import { normalizeNeedJson } from './bds-buyer.util';

function norm(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function scoreProduct(
  need: Record<string, unknown>,
  product: Record<string, unknown>,
): number {
  let score = 0;
  const needPn = need.pn ?? need.bedrooms;
  if (needPn != null && product.bedrooms != null && Number(needPn) === Number(product.bedrooms)) {
    score += 1;
  }
  const needDir = norm(need.huong ?? need.direction);
  const prodDir = norm(product.direction);
  if (needDir && prodDir && needDir === prodDir) score += 1;
  const needZone = norm(need.zone);
  const prodZone = norm(product.zone);
  if (needZone && prodZone && needZone === prodZone) score += 1;
  const budget = need.budget_vnd ?? need.budget;
  const price = product.list_price_vnd ?? product.net_price_vnd;
  if (budget != null && price != null && Number(price) <= Number(budget)) score += 1;
  return score;
}

@Injectable()
export class BdsBuyerMatchingService {
  constructor(
    private readonly leadRepo: BdsBuyerLeadRepository,
    private readonly products: BdsReProductPgRepository,
    private readonly agencyRepo: BdsAgencyRepository,
  ) {}

  async match(
    leadId: number,
    tenantId: string,
    opts: { agencyId?: string } = {},
  ): Promise<MatchRow[]> {
    const lead = await this.leadRepo.getLeadForScope(leadId);
    if (!lead || lead.tenant_id !== tenantId) {
      throw new NotFoundException({ error: 'not_found' });
    }
    const projectId = lead.re_project_id;
    if (!projectId) return [];

    const need = normalizeNeedJson(lead.meta_json.need_json);
    let units = (await this.products.listByProject(projectId)).filter(
      (row) => norm(row.status) === 'available',
    );

    const agencyId = String(opts.agencyId ?? '').trim();
    if (agencyId && isBdsAgencyEnabled()) {
      const basket = await this.agencyRepo.listOpenUnits(agencyId, projectId);
      const allowed = new Set(basket.map((row) => Number(row.product_id)));
      units = units.filter((row) => allowed.has(Number(row.id)));
    }

    const scored: MatchRow[] = units.map((row) => ({
      product_id: Number(row.id),
      unit_code: String(row.unit_code ?? ''),
      score: scoreProduct(need, row),
      list_price_vnd: Number(row.list_price_vnd ?? 0),
      bedrooms: row.bedrooms != null ? Number(row.bedrooms) : null,
      direction: String(row.direction ?? ''),
      zone: String(row.zone ?? ''),
    }));

    return scored.sort((a, b) => b.score - a.score).slice(0, 20);
  }
}
