import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  CreateHrDocTypeBody,
  CreateHrDocWalletCardBody,
  HrDocTypeRow,
  HrDocWalletCardRow,
  HrDocWalletEducationRow,
  HrDocWalletFileRow,
  HrWalletListQuery,
  HrWalletRosterStatRow,
  PatchHrDocWalletCardBody,
} from './hr-doc-wallet.types';
import { computeDocCardStatus, computeWalletCompleteness, countExpiringCards, isEducationCategory } from './hr-doc-wallet.util';

const CARD_SELECT = `
  w.id::int, w.staff_id::int, w.type_code, t.label AS type_label, t.category AS type_category,
  w.title, w.doc_no, w.issuer, w.issued_on::text, w.expires_on::text, w.status, w.visibility,
  w.pinned, w.linked_entity, w.notes,
  COALESCE(w.submitted_by, '') AS submitted_by,
  COALESCE(w.reviewed_by, '') AS reviewed_by,
  w.reviewed_at::text AS reviewed_at,
  w.created_at::text, w.updated_at::text,
  COALESCE(f.cnt, 0)::int AS file_count
`;

@Injectable()
export class HrDocWalletRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private walletReadyCache: boolean | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.walletReadyCache = null;
  }

  async walletTablesReady(): Promise<boolean> {
    if (this.walletReadyCache != null) return this.walletReadyCache;
    try {
      await this.db.query(`SELECT 1 FROM hr_doc_wallet LIMIT 1`);
      this.walletReadyCache = true;
    } catch {
      this.walletReadyCache = false;
    }
    return this.walletReadyCache;
  }

  private mapType(row: Record<string, unknown>): HrDocTypeRow {
    return {
      type_code: String(row.type_code),
      label: String(row.label ?? ''),
      category: String(row.category ?? 'other') as HrDocTypeRow['category'],
      is_system: Boolean(row.is_system),
      is_required_onboard: Boolean(row.is_required_onboard),
      is_required_official: Boolean(row.is_required_official),
      sort_order: Number(row.sort_order ?? 0),
    };
  }

  private mapFile(row: Record<string, unknown>): HrDocWalletFileRow {
    return {
      id: Number(row.id),
      card_id: Number(row.card_id),
      storage_key: String(row.storage_key ?? ''),
      original_name: String(row.original_name ?? ''),
      mime_type: String(row.mime_type ?? ''),
      size_bytes: Number(row.size_bytes ?? 0),
      created_at: String(row.created_at ?? ''),
    };
  }

  private mapEducation(row: Record<string, unknown> | null): HrDocWalletEducationRow | null {
    if (!row) return null;
    return {
      card_id: Number(row.card_id),
      level: String(row.level ?? ''),
      major: String(row.major ?? ''),
      school: String(row.school ?? ''),
      graduated_on: row.graduated_on ? String(row.graduated_on).slice(0, 10) : null,
      classification: String(row.classification ?? ''),
      training_form: String(row.training_form ?? ''),
    };
  }

  private mapCard(row: Record<string, unknown>, education: HrDocWalletEducationRow | null, files: HrDocWalletFileRow[]): HrDocWalletCardRow {
    const status = computeDocCardStatus(
      row.expires_on ? String(row.expires_on).slice(0, 10) : null,
      String(row.status ?? 'valid') as HrDocWalletCardRow['status'],
    );
    return {
      id: Number(row.id),
      staff_id: Number(row.staff_id),
      type_code: String(row.type_code),
      type_label: String(row.type_label ?? ''),
      type_category: String(row.type_category ?? 'other') as HrDocWalletCardRow['type_category'],
      title: String(row.title ?? ''),
      doc_no: String(row.doc_no ?? ''),
      issuer: String(row.issuer ?? ''),
      issued_on: row.issued_on ? String(row.issued_on).slice(0, 10) : null,
      expires_on: row.expires_on ? String(row.expires_on).slice(0, 10) : null,
      status,
      visibility: String(row.visibility ?? 'hr_only') as HrDocWalletCardRow['visibility'],
      pinned: Boolean(row.pinned),
      linked_entity: String(row.linked_entity ?? ''),
      notes: String(row.notes ?? ''),
      submitted_by: String(row.submitted_by ?? ''),
      reviewed_by: String(row.reviewed_by ?? ''),
      reviewed_at: row.reviewed_at ? String(row.reviewed_at) : null,
      file_count: Number(row.file_count ?? files.length),
      education,
      files,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  async listDocTypes(): Promise<HrDocTypeRow[]> {
    const result = await this.db.query(
      `SELECT type_code, label, category, is_system, is_required_onboard, is_required_official, sort_order
       FROM hr_doc_types
       ORDER BY sort_order, type_code`,
    );
    return result.rows.map((r) => this.mapType(r as Record<string, unknown>));
  }

  async createDocType(body: CreateHrDocTypeBody): Promise<HrDocTypeRow> {
    const typeCode = String(body.type_code ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_');
    if (!typeCode) throw new BadRequestException({ error: 'invalid_type_code' });
    const result = await this.db.query(
      `INSERT INTO hr_doc_types (type_code, label, category, is_system, is_required_onboard, is_required_official)
       VALUES ($1, $2, $3, FALSE, $4, $5)
       ON CONFLICT (type_code) DO UPDATE SET
         label = EXCLUDED.label,
         category = EXCLUDED.category,
         updated_at = NOW()
       RETURNING type_code, label, category, is_system, is_required_onboard, is_required_official, sort_order`,
      [
        typeCode,
        String(body.label ?? typeCode).trim(),
        String(body.category ?? 'other'),
        Boolean(body.is_required_onboard),
        Boolean(body.is_required_official),
      ],
    );
    return this.mapType(result.rows[0] as Record<string, unknown>);
  }

  async listCards(staffId: number, query: HrWalletListQuery = {}): Promise<HrDocWalletCardRow[]> {
    const clauses = ['w.staff_id = $1', 'w.deleted_at IS NULL'];
    const params: unknown[] = [staffId];
    if (query.category) {
      params.push(query.category);
      clauses.push(`t.category = $${params.length}`);
    }
    if (query.expiring_only) {
      clauses.push(`w.expires_on IS NOT NULL AND w.expires_on <= (CURRENT_DATE + INTERVAL '30 days')`);
    }
    if (query.education_only) {
      clauses.push(`t.category IN ('education', 'cert')`);
    }
    if (query.pending_review_only) {
      clauses.push(`w.status = 'pending_review'`);
    }
    if (query.self_visible_only) {
      clauses.push(`(w.visibility = 'self' OR w.status = 'pending_review')`);
    }
    const result = await this.db.query(
      `SELECT ${CARD_SELECT}
       FROM hr_doc_wallet w
       JOIN hr_doc_types t ON t.type_code = w.type_code
       LEFT JOIN (
         SELECT card_id, COUNT(*)::int AS cnt
         FROM hr_doc_wallet_files
         WHERE deleted_at IS NULL
         GROUP BY card_id
       ) f ON f.card_id = w.id
       WHERE ${clauses.join(' AND ')}
       ORDER BY w.pinned DESC, w.expires_on NULLS LAST, w.id DESC`,
      params,
    );
    const cards: HrDocWalletCardRow[] = [];
    for (const row of result.rows) {
      const id = Number((row as Record<string, unknown>).id);
      const files = await this.listFiles(id);
      const edu = await this.getEducation(id);
      cards.push(this.mapCard(row as Record<string, unknown>, edu, files));
    }
    if (query.missing_files) {
      return cards.filter((c) => c.file_count === 0);
    }
    return cards;
  }

  async getCard(staffId: number, cardId: number): Promise<HrDocWalletCardRow | null> {
    const result = await this.db.query(
      `SELECT ${CARD_SELECT}
       FROM hr_doc_wallet w
       JOIN hr_doc_types t ON t.type_code = w.type_code
       LEFT JOIN (
         SELECT card_id, COUNT(*)::int AS cnt FROM hr_doc_wallet_files WHERE deleted_at IS NULL GROUP BY card_id
       ) f ON f.card_id = w.id
       WHERE w.id = $1 AND w.staff_id = $2 AND w.deleted_at IS NULL
       LIMIT 1`,
      [cardId, staffId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const files = await this.listFiles(cardId);
    const edu = await this.getEducation(cardId);
    return this.mapCard(row as Record<string, unknown>, edu, files);
  }

  async createCard(
    staffId: number,
    body: CreateHrDocWalletCardBody,
    meta?: { submittedBy?: string; forcePending?: boolean },
  ): Promise<HrDocWalletCardRow> {
    const typeCode = String(body.type_code ?? '').trim();
    if (!typeCode) throw new BadRequestException({ error: 'type_code_required' });
    const typeCheck = await this.db.query(`SELECT category FROM hr_doc_types WHERE type_code = $1`, [typeCode]);
    if (!typeCheck.rows[0]) throw new BadRequestException({ error: 'unknown_type_code', type_code: typeCode });
    const category = String((typeCheck.rows[0] as Record<string, unknown>).category ?? '');
    const status = meta?.forcePending ? 'pending_review' : computeDocCardStatus(body.expires_on ?? null);
    const visibility = meta?.forcePending ? 'self' : (body.visibility ?? 'hr_only');
    const result = await this.db.query(
      `INSERT INTO hr_doc_wallet
         (staff_id, type_code, title, doc_no, issuer, issued_on, expires_on, status, visibility, pinned, linked_entity, notes, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, $10, $11, $12, $13)
       RETURNING id::int, staff_id::int, type_code, title, doc_no, issuer, issued_on::text, expires_on::text,
                 status, visibility, pinned, linked_entity, notes, submitted_by, reviewed_by, reviewed_at::text,
                 created_at::text, updated_at::text`,
      [
        staffId,
        typeCode,
        String(body.title ?? '').trim(),
        String(body.doc_no ?? '').trim(),
        String(body.issuer ?? '').trim(),
        body.issued_on || null,
        body.expires_on || null,
        status,
        visibility,
        meta?.forcePending ? false : Boolean(body.pinned),
        String(body.linked_entity ?? '').trim(),
        String(body.notes ?? '').trim(),
        String(meta?.submittedBy ?? ''),
      ],
    );
    const row = result.rows[0] as Record<string, unknown>;
    const cardId = Number(row.id);
    if (isEducationCategory(category) && body.education) {
      await this.upsertEducation(cardId, body.education);
    }
    const created = await this.getCard(staffId, cardId);
    if (!created) throw new NotFoundException({ error: 'card_not_found', id: cardId });
    return created;
  }

  async patchCard(staffId: number, cardId: number, body: PatchHrDocWalletCardBody): Promise<HrDocWalletCardRow | null> {
    const existing = await this.getCard(staffId, cardId);
    if (!existing) throw new NotFoundException({ error: 'card_not_found', id: cardId });
    if (body.deleted) {
      await this.db.query(`UPDATE hr_doc_wallet SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1`, [cardId]);
      return null;
    }
    const expiresOn = body.expires_on !== undefined ? body.expires_on : existing.expires_on;
    const status = body.status ?? computeDocCardStatus(expiresOn, existing.status);
    await this.db.query(
      `UPDATE hr_doc_wallet SET
         title = COALESCE($3, title),
         doc_no = COALESCE($4, doc_no),
         issuer = COALESCE($5, issuer),
         issued_on = COALESCE($6::date, issued_on),
         expires_on = COALESCE($7::date, expires_on),
         status = $8,
         visibility = COALESCE($9, visibility),
         pinned = COALESCE($10, pinned),
         linked_entity = COALESCE($11, linked_entity),
         notes = COALESCE($12, notes),
         updated_at = NOW()
       WHERE id = $1 AND staff_id = $2 AND deleted_at IS NULL`,
      [
        cardId,
        staffId,
        body.title ?? null,
        body.doc_no ?? null,
        body.issuer ?? null,
        body.issued_on ?? null,
        body.expires_on ?? null,
        status,
        body.visibility ?? null,
        body.pinned ?? null,
        body.linked_entity ?? null,
        body.notes ?? null,
      ],
    );
    if (body.education) await this.upsertEducation(cardId, body.education);
    const updated = await this.getCard(staffId, cardId);
    if (!updated) throw new NotFoundException({ error: 'card_not_found', id: cardId });
    return updated;
  }

  private async upsertEducation(cardId: number, body: Partial<HrDocWalletEducationRow>): Promise<void> {
    await this.db.query(
      `INSERT INTO hr_doc_wallet_education (card_id, level, major, school, graduated_on, classification, training_form)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7)
       ON CONFLICT (card_id) DO UPDATE SET
         level = EXCLUDED.level,
         major = EXCLUDED.major,
         school = EXCLUDED.school,
         graduated_on = EXCLUDED.graduated_on,
         classification = EXCLUDED.classification,
         training_form = EXCLUDED.training_form`,
      [
        cardId,
        String(body.level ?? ''),
        String(body.major ?? ''),
        String(body.school ?? ''),
        body.graduated_on || null,
        String(body.classification ?? ''),
        String(body.training_form ?? ''),
      ],
    );
  }

  private async getEducation(cardId: number): Promise<HrDocWalletEducationRow | null> {
    const result = await this.db.query(
      `SELECT card_id::int, level, major, school, graduated_on::text, classification, training_form
       FROM hr_doc_wallet_education WHERE card_id = $1`,
      [cardId],
    );
    return result.rows[0] ? this.mapEducation(result.rows[0] as Record<string, unknown>) : null;
  }

  async listFiles(cardId: number): Promise<HrDocWalletFileRow[]> {
    const result = await this.db.query(
      `SELECT id::int, card_id::int, storage_key, original_name, mime_type, size_bytes::bigint, created_at::text
       FROM hr_doc_wallet_files
       WHERE card_id = $1 AND deleted_at IS NULL
       ORDER BY id`,
      [cardId],
    );
    return result.rows.map((r) => this.mapFile(r as Record<string, unknown>));
  }

  async getFile(cardId: number, fileId: number): Promise<HrDocWalletFileRow | null> {
    const result = await this.db.query(
      `SELECT id::int, card_id::int, storage_key, original_name, mime_type, size_bytes::bigint, created_at::text
       FROM hr_doc_wallet_files
       WHERE id = $1 AND card_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [fileId, cardId],
    );
    return result.rows[0] ? this.mapFile(result.rows[0] as Record<string, unknown>) : null;
  }

  async countFiles(cardId: number): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS n FROM hr_doc_wallet_files WHERE card_id = $1 AND deleted_at IS NULL`,
      [cardId],
    );
    return Number((result.rows[0] as Record<string, unknown> | undefined)?.n ?? 0);
  }

  async addFile(
    cardId: number,
    input: { storageKey: string; originalName: string; mimeType: string; sizeBytes: number },
  ): Promise<HrDocWalletFileRow> {
    const result = await this.db.query(
      `INSERT INTO hr_doc_wallet_files (card_id, storage_key, original_name, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id::int, card_id::int, storage_key, original_name, mime_type, size_bytes::bigint, created_at::text`,
      [cardId, input.storageKey, input.originalName, input.mimeType, input.sizeBytes],
    );
    return this.mapFile(result.rows[0] as Record<string, unknown>);
  }

  async listRequiredTypes(): Promise<HrDocTypeRow[]> {
    const all = await this.listDocTypes();
    return all.filter((t) => t.is_required_onboard);
  }

  async listPendingReview(limit = 50): Promise<Array<HrDocWalletCardRow & { staff_name: string; internal_code: string }>> {
    const result = await this.db.query(
      `SELECT ${CARD_SELECT}, s.name AS staff_name, s.internal_code
       FROM hr_doc_wallet w
       JOIN hr_doc_types t ON t.type_code = w.type_code
       JOIN crm_staff s ON s.id = w.staff_id
       LEFT JOIN (
         SELECT card_id, COUNT(*)::int AS cnt FROM hr_doc_wallet_files WHERE deleted_at IS NULL GROUP BY card_id
       ) f ON f.card_id = w.id
       WHERE w.deleted_at IS NULL AND w.status = 'pending_review'
       ORDER BY w.created_at ASC
       LIMIT $1`,
      [limit],
    );
    const out: Array<HrDocWalletCardRow & { staff_name: string; internal_code: string }> = [];
    for (const row of result.rows) {
      const id = Number((row as Record<string, unknown>).id);
      const files = await this.listFiles(id);
      const edu = await this.getEducation(id);
      const card = this.mapCard(row as Record<string, unknown>, edu, files);
      out.push({
        ...card,
        staff_name: String((row as Record<string, unknown>).staff_name ?? ''),
        internal_code: String((row as Record<string, unknown>).internal_code ?? ''),
      });
    }
    return out;
  }

  async reviewCard(
    staffId: number,
    cardId: number,
    input: { approve: boolean; reviewedBy: string; notes?: string },
  ): Promise<HrDocWalletCardRow> {
    const existing = await this.getCard(staffId, cardId);
    if (!existing) throw new NotFoundException({ error: 'card_not_found', id: cardId });
    if (existing.status !== 'pending_review') {
      throw new BadRequestException({ error: 'card_not_pending', status: existing.status });
    }
    const nextStatus = input.approve ? computeDocCardStatus(existing.expires_on, 'valid') : 'revoked';
    await this.db.query(
      `UPDATE hr_doc_wallet SET
         status = $3,
         notes = COALESCE($4, notes),
         reviewed_by = $5,
         reviewed_at = NOW(),
         updated_at = NOW()
       WHERE id = $1 AND staff_id = $2 AND deleted_at IS NULL`,
      [cardId, staffId, nextStatus, input.notes ?? null, input.reviewedBy],
    );
    const updated = await this.getCard(staffId, cardId);
    if (!updated) throw new NotFoundException({ error: 'card_not_found', id: cardId });
    return updated;
  }

  async listWalletExportRows(): Promise<
    Array<{
      staff_id: number;
      name: string;
      internal_code: string;
      dept_name: string;
      wallet_pct: number;
      expiring_count: number;
      pending_count: number;
    }>
  > {
    const staffResult = await this.db.query(
      `SELECT s.id::int, s.name, s.internal_code, COALESCE(d.name, '') AS dept_name
       FROM crm_staff s
       LEFT JOIN crm_departments d ON d.id = s.department
       WHERE s.active = 1
       ORDER BY s.name ASC
       LIMIT 2000`,
    );
    const types = await this.listRequiredTypes();
    const out: Array<{
      staff_id: number;
      name: string;
      internal_code: string;
      dept_name: string;
      wallet_pct: number;
      expiring_count: number;
      pending_count: number;
    }> = [];
    for (const row of staffResult.rows) {
      const staffId = Number((row as Record<string, unknown>).id);
      const cards = await this.listCards(staffId);
      out.push({
        staff_id: staffId,
        name: String((row as Record<string, unknown>).name ?? ''),
        internal_code: String((row as Record<string, unknown>).internal_code ?? ''),
        dept_name: String((row as Record<string, unknown>).dept_name ?? ''),
        wallet_pct: computeWalletCompleteness(types, cards),
        expiring_count: countExpiringCards(cards),
        pending_count: cards.filter((c) => c.status === 'pending_review').length,
      });
    }
    return out;
  }

  async listDependentsExportRows(): Promise<
    Array<{
      staff_id: number;
      staff_name: string;
      internal_code: string;
      dependent_name: string;
      relation: string;
      dob: string | null;
      tax_dependent: boolean;
      cccd: string;
    }>
  > {
    try {
      const result = await this.db.query(
        `SELECT d.staff_id::int, s.name AS staff_name, s.internal_code,
                d.name AS dependent_name, d.relation, d.dob::text, d.tax_dependent, d.cccd
         FROM hr_staff_dependents d
         JOIN crm_staff s ON s.id = d.staff_id
         WHERE s.active = 1
         ORDER BY s.name ASC, d.name ASC`,
      );
      return result.rows.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          staff_id: Number(row.staff_id),
          staff_name: String(row.staff_name ?? ''),
          internal_code: String(row.internal_code ?? ''),
          dependent_name: String(row.dependent_name ?? ''),
          relation: String(row.relation ?? ''),
          dob: row.dob ? String(row.dob).slice(0, 10) : null,
          tax_dependent: Boolean(row.tax_dependent),
          cccd: String(row.cccd ?? ''),
        };
      });
    } catch {
      return [];
    }
  }

  async rosterWalletStats(staffIds: number[]): Promise<HrWalletRosterStatRow[]> {
    if (!staffIds.length) return [];
    const types = await this.listRequiredTypes();
    const cardsResult = await this.db.query(
      `SELECT w.staff_id::int, w.type_code, w.status,
              COALESCE(f.cnt, 0)::int AS file_count
       FROM hr_doc_wallet w
       LEFT JOIN (
         SELECT card_id, COUNT(*)::int AS cnt FROM hr_doc_wallet_files WHERE deleted_at IS NULL GROUP BY card_id
       ) f ON f.card_id = w.id
       WHERE w.deleted_at IS NULL AND w.staff_id = ANY($1::bigint[])`,
      [staffIds],
    );
    const byStaff = new Map<number, Array<{ type_code: string; status: string; file_count: number }>>();
    for (const row of cardsResult.rows) {
      const sid = Number((row as Record<string, unknown>).staff_id);
      const list = byStaff.get(sid) ?? [];
      list.push({
        type_code: String((row as Record<string, unknown>).type_code),
        status: String((row as Record<string, unknown>).status),
        file_count: Number((row as Record<string, unknown>).file_count),
      });
      byStaff.set(sid, list);
    }
    return staffIds.map((staffId) => {
      const cards = (byStaff.get(staffId) ?? []) as Array<Pick<HrDocWalletCardRow, 'type_code' | 'status' | 'file_count'>>;
      return {
        staff_id: staffId,
        wallet_pct: computeWalletCompleteness(types, cards),
        expiring_count: countExpiringCards(cards),
      };
    });
  }
}
