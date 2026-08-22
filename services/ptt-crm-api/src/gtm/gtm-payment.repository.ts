import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type { SkuInterest } from './gtm-validate.util';

export type GtmPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export type GtmPaymentRow = {
  id: string;
  created_at: string;
  updated_at: string;
  stripe_session_id: string;
  stripe_payment_intent: string | null;
  sku: SkuInterest;
  amount_cents: number;
  currency: string;
  status: GtmPaymentStatus;
  payer_email: string;
  demo_request_id: string | null;
  metadata: Record<string, unknown>;
};

function rowToPayment(row: Record<string, unknown>): GtmPaymentRow {
  return {
    id: String(row.id),
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    stripe_session_id: String(row.stripe_session_id),
    stripe_payment_intent:
      row.stripe_payment_intent != null ? String(row.stripe_payment_intent) : null,
    sku: row.sku as SkuInterest,
    amount_cents: Number(row.amount_cents),
    currency: String(row.currency),
    status: row.status as GtmPaymentStatus,
    payer_email: String(row.payer_email),
    demo_request_id: row.demo_request_id != null ? String(row.demo_request_id) : null,
    metadata:
      typeof row.metadata === 'object' && row.metadata !== null && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
  };
}

@Injectable()
export class GtmPaymentRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private readonly memory = new Map<string, GtmPaymentRow>();

  constructor(private readonly config: AppConfigService) {}

  private get useMemory(): boolean {
    return !this.config.databaseUrl?.trim();
  }

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async insertPending(input: {
    stripe_session_id: string;
    sku: SkuInterest;
    amount_cents: number;
    payer_email: string;
    metadata?: Record<string, unknown>;
  }): Promise<GtmPaymentRow> {
    if (this.useMemory) {
      const now = new Date().toISOString();
      const row: GtmPaymentRow = {
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
        stripe_session_id: input.stripe_session_id,
        stripe_payment_intent: null,
        sku: input.sku,
        amount_cents: input.amount_cents,
        currency: 'usd',
        status: 'pending',
        payer_email: input.payer_email,
        demo_request_id: null,
        metadata: input.metadata ?? {},
      };
      this.memory.set(row.stripe_session_id, row);
      return row;
    }

    const result = await this.db.query(
      `INSERT INTO gtm_payment (
         stripe_session_id, sku, amount_cents, currency, status, payer_email, metadata
       ) VALUES ($1, $2, $3, 'usd', 'pending', $4, $5::jsonb)
       RETURNING *`,
      [
        input.stripe_session_id,
        input.sku,
        input.amount_cents,
        input.payer_email,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return rowToPayment(result.rows[0] as Record<string, unknown>);
  }

  async findByStripeSessionId(stripeSessionId: string): Promise<GtmPaymentRow | null> {
    if (this.useMemory) {
      return this.memory.get(stripeSessionId) ?? null;
    }
    const result = await this.db.query(`SELECT * FROM gtm_payment WHERE stripe_session_id = $1`, [
      stripeSessionId,
    ]);
    const row = result.rows[0];
    return row ? rowToPayment(row as Record<string, unknown>) : null;
  }

  async markPaid(input: {
    stripe_session_id: string;
    stripe_payment_intent?: string | null;
  }): Promise<GtmPaymentRow | null> {
    if (this.useMemory) {
      const row = this.memory.get(input.stripe_session_id);
      if (!row || row.status === 'paid') return row ?? null;
      row.status = 'paid';
      row.stripe_payment_intent = input.stripe_payment_intent ?? null;
      row.updated_at = new Date().toISOString();
      return row;
    }

    const result = await this.db.query(
      `UPDATE gtm_payment
       SET status = 'paid',
           stripe_payment_intent = COALESCE($2, stripe_payment_intent),
           updated_at = now()
       WHERE stripe_session_id = $1 AND status <> 'paid'
       RETURNING *`,
      [input.stripe_session_id, input.stripe_payment_intent ?? null],
    );
    const row = result.rows[0];
    return row ? rowToPayment(row as Record<string, unknown>) : null;
  }

  async markExpired(stripeSessionId: string): Promise<GtmPaymentRow | null> {
    if (this.useMemory) {
      const row = this.memory.get(stripeSessionId);
      if (!row || row.status !== 'pending') return row ?? null;
      row.status = 'expired';
      row.updated_at = new Date().toISOString();
      return row;
    }

    const result = await this.db.query(
      `UPDATE gtm_payment
       SET status = 'expired', updated_at = now()
       WHERE stripe_session_id = $1 AND status = 'pending'
       RETURNING *`,
      [stripeSessionId],
    );
    const row = result.rows[0];
    return row ? rowToPayment(row as Record<string, unknown>) : null;
  }
}
