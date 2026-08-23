import { Injectable, NotFoundException } from '@nestjs/common';
import { resolveLeadFlowKind } from '../../leads-funnel/lead-flow-kind.util';
import { BdsBuyerLeadRepository } from '../buyers/bds-buyer-lead.repository';
import { BdsBuyerRepository } from '../buyers/bds-buyer.repository';
import { BdsReProductPgRepository } from '../inventory/bds-re-product-pg.repository';
import { BdsHoldRepository } from '../hold/bds-hold.repository';
import { BdsTxRepository } from '../transactions/bds-tx.repository';
import {
  maskBdsPhone,
  pickLatestHold,
  pickLatestTx,
  type BdsBoardBuyerRow,
  type BdsSpineBuyerPayload,
} from './bds-buyer-query';

@Injectable()
export class BdsBuyerQueryService {
  constructor(
    private readonly leadRepo: BdsBuyerLeadRepository,
    private readonly buyerRepo: BdsBuyerRepository,
    private readonly holdRepo: BdsHoldRepository,
    private readonly txRepo: BdsTxRepository,
    private readonly products: BdsReProductPgRepository,
  ) {}

  private assertReBuyerLead(lead: NonNullable<Awaited<ReturnType<BdsBuyerLeadRepository['getLeadForScope']>>>): void {
    const kind = resolveLeadFlowKind({
      status: lead.status,
      metaJson: lead.meta_json,
      clientId: null,
      channel: null,
      source: null,
    });
    if (kind !== 're_buyer') {
      throw new NotFoundException();
    }
  }

  private utmFromMeta(meta: Record<string, unknown>): BdsSpineBuyerPayload['utm'] {
    return {
      source: String(meta.utm_source ?? meta.source ?? ''),
      campaign_id: String(meta.campaign_id ?? meta.utm_campaign ?? ''),
      ad_id: String(meta.ad_id ?? ''),
    };
  }

  private async unitCodeForProduct(productId: number | null | undefined): Promise<string | null> {
    if (!productId) return null;
    const row = await this.products.getById(productId);
    return row ? String(row.unit_code ?? '') || null : null;
  }

  async getByLeadId(
    leadId: number,
    tenantId?: string,
    viewPii = false,
  ): Promise<BdsSpineBuyerPayload> {
    const lead = await this.leadRepo.getLeadForScope(leadId);
    if (!lead) throw new NotFoundException();
    this.assertReBuyerLead(lead);
    if (tenantId && lead.tenant_id && lead.tenant_id !== tenantId) {
      throw new NotFoundException();
    }

    const [holds, txs, visits] = await Promise.all([
      this.holdRepo.listByLeadIds([leadId]),
      this.txRepo.listByLeadIds([leadId]),
      this.buyerRepo.listVisitsByLead(leadId),
    ]);
    const hold = pickLatestHold(holds);
    const tx = pickLatestTx(txs);
    const productId = hold?.product_id ?? tx?.product_id ?? null;
    const unitCode = await this.unitCodeForProduct(productId);
    const meta = lead.meta_json;

    return {
      lead_id: lead.id,
      lead_flow_kind: 're_buyer',
      full_name: lead.full_name,
      phone: maskBdsPhone(lead.phone, viewPii),
      re_project_id: lead.re_project_id,
      unit_code: unitCode,
      product_id: productId,
      hold: hold
        ? {
            id: hold.id,
            status: hold.status,
            expires_at: hold.expires_at ? hold.expires_at.toISOString() : null,
          }
        : null,
      tx: tx ? { id: tx.id, stage: tx.stage } : null,
      visits: visits.map((v) => ({
        scheduled_at: v.scheduled_at.toISOString(),
        outcome: v.outcome,
      })),
      utm: this.utmFromMeta(meta),
      touched_at:
        meta.touched_at != null
          ? String(meta.touched_at)
          : lead.received_at ?? lead.created_at,
    };
  }

  async getBoardRows(leadIds: number[], tenantId?: string): Promise<Map<number, BdsBoardBuyerRow>> {
    const out = new Map<number, BdsBoardBuyerRow>();
    if (!leadIds.length) return out;

    const [holds, txs] = await Promise.all([
      this.holdRepo.listByLeadIds(leadIds),
      this.txRepo.listByLeadIds(leadIds),
    ]);

    const holdsByLead = new Map<number, typeof holds>();
    for (const h of holds) {
      const list = holdsByLead.get(h.lead_id) ?? [];
      list.push(h);
      holdsByLead.set(h.lead_id, list);
    }
    const txsByLead = new Map<number, typeof txs>();
    for (const t of txs) {
      const list = txsByLead.get(t.lead_id) ?? [];
      list.push(t);
      txsByLead.set(t.lead_id, list);
    }

    const productIds = new Set<number>();
    for (const id of leadIds) {
      const hold = pickLatestHold(holdsByLead.get(id) ?? []);
      const tx = pickLatestTx(txsByLead.get(id) ?? []);
      if (hold?.product_id) productIds.add(hold.product_id);
      if (tx?.product_id) productIds.add(tx.product_id);
    }

    const unitByProduct = new Map<number, string>();
    await Promise.all(
      [...productIds].map(async (pid) => {
        const row = await this.products.getById(pid);
        if (row) unitByProduct.set(pid, String(row.unit_code ?? ''));
      }),
    );

    for (const id of leadIds) {
      const hold = pickLatestHold(holdsByLead.get(id) ?? []);
      const tx = pickLatestTx(txsByLead.get(id) ?? []);
      const productId = hold?.product_id ?? tx?.product_id ?? null;
      if (tenantId && hold?.tenant_id && hold.tenant_id !== tenantId) continue;
      out.set(id, {
        re_project_id: hold?.project_id ?? tx?.project_id ?? null,
        unit_code: productId ? unitByProduct.get(productId) ?? null : null,
        hold_expires_at: hold?.expires_at ? hold.expires_at.toISOString() : null,
        tx_stage: tx?.stage ?? null,
      });
    }
    return out;
  }
}
