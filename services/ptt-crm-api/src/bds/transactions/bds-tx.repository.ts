import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../../config/app-config.service';
import type {
  IdempotencyRow,
  InsertTxInput,
  MortgageStatus,
  TitleStatus,
  TxChannel,
  TxRow,
  TxStage,
} from './bds-tx.types';

const STAGE_EXTRA_COLS: Record<string, string> = {
  deposit_vnd: 'deposit_vnd',
  deposit_paid_at: 'deposit_paid_at',
  reservation_fee_vnd: 'reservation_fee_vnd',
  reservation_paid_at: 'reservation_paid_at',
  vbtt_no: 'vbtt_no',
  vbtt_at: 'vbtt_at',
  contract_no: 'contract_no',
  contracted_at: 'contracted_at',
  lost_reason: 'lost_reason',
  list_price_vnd: 'list_price_vnd',
  net_price_vnd: 'net_price_vnd',
  discount_vnd: 'discount_vnd',
  policy_id: 'policy_id',
  handover_at: 'handover_at',
  title_issued_at: 'title_issued_at',
  title_status: 'title_status',
  handover_appointment_at: 'handover_appointment_at',
  handover_waived_at: 'handover_waived_at',
  handover_waived_by: 'handover_waived_by',
  handover_waive_reason: 'handover_waive_reason',
};

@Injectable()
export class BdsTxRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  private optStr(value: unknown): string | null {
    return value != null ? String(value) : null;
  }

  private optDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    return value instanceof Date ? value : new Date(String(value));
  }

  private asDate(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private mapTx(row: Record<string, unknown>): TxRow {
    return {
      id: String(row.id),
      tenant_id: this.optStr(row.tenant_id),
      project_id: Number(row.project_id),
      product_id: Number(row.product_id),
      hold_id: this.optStr(row.hold_id),
      lead_id: Number(row.lead_id),
      buyer_id: this.optStr(row.buyer_id),
      policy_id: this.optStr(row.policy_id),
      channel_partner_id: String(row.channel_partner_id ?? ''),
      closer_staff_id: row.closer_staff_id == null ? null : Number(row.closer_staff_id),
      first_touch_staff_id:
        row.first_touch_staff_id == null ? null : Number(row.first_touch_staff_id),
      stage: String(row.stage) as TxStage,
      channel: String(row.channel) as TxChannel,
      list_price_vnd: Number(row.list_price_vnd ?? 0),
      net_price_vnd: Number(row.net_price_vnd ?? 0),
      discount_vnd: Number(row.discount_vnd ?? 0),
      reservation_fee_vnd: Number(row.reservation_fee_vnd ?? 0),
      reservation_paid_at: this.optDate(row.reservation_paid_at),
      deposit_vnd: Number(row.deposit_vnd ?? 0),
      deposit_paid_at: this.optDate(row.deposit_paid_at),
      vbtt_no: String(row.vbtt_no ?? ''),
      vbtt_at: this.optDate(row.vbtt_at),
      contract_no: String(row.contract_no ?? ''),
      contracted_at: this.optDate(row.contracted_at),
      paid_pct: Number(row.paid_pct ?? 0),
      mortgage_status: String(row.mortgage_status ?? 'none') as MortgageStatus,
      handover_at: this.optDate(row.handover_at),
      title_issued_at: this.optDate(row.title_issued_at),
      title_status: String(row.title_status ?? 'not_started') as TitleStatus,
      handover_appointment_at: this.optDate(row.handover_appointment_at),
      handover_waived_at: this.optDate(row.handover_waived_at),
      handover_waived_by: row.handover_waived_by == null ? null : Number(row.handover_waived_by),
      handover_waive_reason: String(row.handover_waive_reason ?? ''),
      lost_reason: String(row.lost_reason ?? ''),
      created_at: this.asDate(row.created_at),
      updated_at: this.asDate(row.updated_at),
    };
  }

  async insertTx(row: InsertTxInput): Promise<TxRow> {
    const tenantId = String(row.tenant_id ?? '').trim() || null;
    try {
      const res = await this.db.query(
        `INSERT INTO bds_transactions (
           tenant_id, project_id, product_id, hold_id, lead_id, buyer_id, policy_id,
           channel_partner_id, closer_staff_id, first_touch_staff_id, stage, channel,
           list_price_vnd, net_price_vnd, discount_vnd, reservation_fee_vnd, reservation_paid_at,
           deposit_vnd, deposit_paid_at, vbtt_no, vbtt_at, contract_no, contracted_at,
           paid_pct, mortgage_status, handover_at, title_issued_at, lost_reason
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
         ) RETURNING *`,
        [
          tenantId,
          row.project_id,
          row.product_id,
          row.hold_id ?? null,
          row.lead_id,
          row.buyer_id ?? null,
          row.policy_id ?? null,
          String(row.channel_partner_id ?? ''),
          row.closer_staff_id ?? null,
          row.first_touch_staff_id ?? null,
          row.stage,
          row.channel ?? 'inhouse',
          row.list_price_vnd ?? 0,
          row.net_price_vnd ?? 0,
          row.discount_vnd ?? 0,
          row.reservation_fee_vnd ?? 0,
          row.reservation_paid_at ?? null,
          row.deposit_vnd ?? 0,
          row.deposit_paid_at ?? null,
          String(row.vbtt_no ?? ''),
          row.vbtt_at ?? null,
          String(row.contract_no ?? ''),
          row.contracted_at ?? null,
          row.paid_pct ?? 0,
          row.mortgage_status ?? 'none',
          row.handover_at ?? null,
          row.title_issued_at ?? null,
          String(row.lost_reason ?? ''),
        ],
      );
      return this.mapTx(res.rows[0] as Record<string, unknown>);
    } catch (err) {
      if (err && typeof err === 'object' && (err as { code?: string }).code === '23505') {
        throw { code: '23505' };
      }
      throw err;
    }
  }

  async getTx(id: string): Promise<TxRow | null> {
    const res = await this.db.query(`SELECT * FROM bds_transactions WHERE id = $1 LIMIT 1`, [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTx(row) : null;
  }

  async getOpenByProduct(productId: number): Promise<TxRow | null> {
    const res = await this.db.query(
      `SELECT * FROM bds_transactions
       WHERE product_id = $1 AND stage NOT IN ('cancelled', 'lost')
       LIMIT 1`,
      [productId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTx(row) : null;
  }

  async listByProject(projectId: number): Promise<TxRow[]> {
    const res = await this.db.query(
      `SELECT * FROM bds_transactions WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId],
    );
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapTx(row));
  }

  async setStageIf(
    id: string,
    stage: TxStage,
    extra: Record<string, unknown>,
    expected: TxStage,
  ): Promise<TxRow | null> {
    const sets: string[] = ['stage = $2', 'updated_at = NOW()'];
    const params: unknown[] = [id, stage];
    let idx = 3;

    for (const [key, col] of Object.entries(STAGE_EXTRA_COLS)) {
      if (extra[key] !== undefined) {
        sets.push(`${col} = $${idx}`);
        params.push(extra[key]);
        idx += 1;
      }
    }

    params.push(expected);
    const res = await this.db.query(
      `UPDATE bds_transactions SET ${sets.join(', ')}
       WHERE id = $1 AND stage = $${idx}
       RETURNING *`,
      params,
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapTx(row) : null;
  }

  async resolveProjectTenantId(projectId: number): Promise<string | null> {
    const res = await this.db.query(
      `SELECT tenant_id FROM crm_re_projects WHERE id = $1`,
      [projectId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row?.tenant_id != null ? String(row.tenant_id) : null;
  }

  async getProjectOnePrice(projectId: number): Promise<boolean | null> {
    const res = await this.db.query(
      `SELECT one_price FROM crm_re_projects WHERE id = $1`,
      [projectId],
    );
    if (!res.rows[0]) return null;
    return Boolean((res.rows[0] as Record<string, unknown>).one_price);
  }

  async getIdempotency(route: string, key: string): Promise<IdempotencyRow | null> {
    const res = await this.db.query(
      `SELECT route, key, request_hash, status_code, response_json, created_at
       FROM bds_idempotency_keys
       WHERE route = $1 AND key = $2
       LIMIT 1`,
      [route, key],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const body = row.response_json;
    return {
      route: String(row.route),
      key: String(row.key),
      request_hash: String(row.request_hash ?? ''),
      status_code: Number(row.status_code),
      response_json: typeof body === 'string' ? JSON.parse(body) : body,
      created_at: this.asDate(row.created_at),
    };
  }

  async putIdempotency(input: {
    route: string;
    key: string;
    status_code: number;
    response_json: unknown;
    request_hash?: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO bds_idempotency_keys (route, key, request_hash, status_code, response_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (route, key) DO UPDATE SET
         status_code = EXCLUDED.status_code,
         response_json = EXCLUDED.response_json,
         created_at = NOW()`,
      [
        input.route,
        input.key,
        input.request_hash ?? '',
        input.status_code,
        JSON.stringify(input.response_json ?? {}),
      ],
    );
  }

  async sumContractedForAgencyInPeriod(
    agencyId: string,
    from: Date,
    to: Date,
  ): Promise<{ gmv: number; units: number }> {
    const res = await this.db.query(
      `SELECT COALESCE(SUM(net_price_vnd), 0)::bigint AS gmv, COUNT(*)::int AS units
       FROM bds_transactions
       WHERE channel_partner_id = $1
         AND stage = 'contracted'
         AND contracted_at >= $2
         AND contracted_at < $3`,
      [agencyId, from, to],
    );
    const row = res.rows[0] as { gmv?: string | number; units?: number };
    return { gmv: Number(row.gmv ?? 0), units: Number(row.units ?? 0) };
  }
}
