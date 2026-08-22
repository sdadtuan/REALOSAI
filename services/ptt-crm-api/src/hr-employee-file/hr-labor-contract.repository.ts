import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  CreateHrLaborAppendixBody,
  CreateHrLaborContractBody,
  HrLaborContractAppendixRow,
  HrLaborContractRow,
  HrLaborContractSummary,
  PatchHrLaborAppendixBody,
  PatchHrLaborContractBody,
} from './hr-labor-contract.types';
import { computeContractDisplayStatus, isContractExpiringSoon } from './hr-labor-contract.util';

const CONTRACT_SELECT = `
  c.id::int, c.staff_id::int, c.contract_no, c.kind,
  c.signed_on::text, c.effective_on::text, c.expires_on::text,
  c.salary_gross::float8, c.currency, c.work_place, c.job_title_legal,
  c.status, c.document_id::int, w.title AS document_title, c.notes,
  c.created_at::text, c.updated_at::text
`;

@Injectable()
export class HrLaborContractRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private readyCache: boolean | null = null;

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) this.pool = new Pool({ connectionString: this.config.databaseUrl });
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.readyCache = null;
  }

  async tablesReady(): Promise<boolean> {
    if (this.readyCache != null) return this.readyCache;
    try {
      await this.db.query(`SELECT 1 FROM hr_labor_contracts LIMIT 1`);
      this.readyCache = true;
    } catch {
      this.readyCache = false;
    }
    return this.readyCache;
  }

  private mapAppendix(row: Record<string, unknown>): HrLaborContractAppendixRow {
    return {
      id: Number(row.id),
      contract_id: Number(row.contract_id),
      appendix_no: String(row.appendix_no ?? ''),
      signed_on: row.signed_on ? String(row.signed_on).slice(0, 10) : null,
      effective_on: row.effective_on ? String(row.effective_on).slice(0, 10) : null,
      summary: String(row.summary ?? ''),
      salary_gross: row.salary_gross == null ? null : Number(row.salary_gross),
      document_id: row.document_id == null ? null : Number(row.document_id),
      document_title: row.document_title ? String(row.document_title) : null,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private mapContract(row: Record<string, unknown>, appendices: HrLaborContractAppendixRow[]): HrLaborContractRow {
    const kind = String(row.kind ?? 'fixed') as HrLaborContractRow['kind'];
    const status = computeContractDisplayStatus({
      status: String(row.status ?? 'draft') as HrLaborContractRow['status'],
      expires_on: row.expires_on ? String(row.expires_on).slice(0, 10) : null,
      kind,
    }) as HrLaborContractRow['status'];
    return {
      id: Number(row.id),
      staff_id: Number(row.staff_id),
      contract_no: String(row.contract_no ?? ''),
      kind,
      signed_on: row.signed_on ? String(row.signed_on).slice(0, 10) : null,
      effective_on: row.effective_on ? String(row.effective_on).slice(0, 10) : null,
      expires_on: row.expires_on ? String(row.expires_on).slice(0, 10) : null,
      salary_gross: row.salary_gross == null ? null : Number(row.salary_gross),
      currency: String(row.currency ?? 'VND'),
      work_place: String(row.work_place ?? ''),
      job_title_legal: String(row.job_title_legal ?? ''),
      status,
      document_id: row.document_id == null ? null : Number(row.document_id),
      document_title: row.document_title ? String(row.document_title) : null,
      notes: String(row.notes ?? ''),
      appendices,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }

  private async listAppendices(contractId: number): Promise<HrLaborContractAppendixRow[]> {
    const result = await this.db.query(
      `SELECT a.id::int, a.contract_id::int, a.appendix_no, a.signed_on::text, a.effective_on::text,
              a.summary, a.salary_gross::float8, a.document_id::int, w.title AS document_title,
              a.created_at::text, a.updated_at::text
       FROM hr_labor_contract_appendices a
       LEFT JOIN hr_doc_wallet w ON w.id = a.document_id
       WHERE a.contract_id = $1
       ORDER BY a.effective_on DESC NULLS LAST, a.id DESC`,
      [contractId],
    );
    return result.rows.map((r) => this.mapAppendix(r as Record<string, unknown>));
  }

  async listForStaff(staffId: number): Promise<HrLaborContractRow[]> {
    const result = await this.db.query(
      `SELECT ${CONTRACT_SELECT}
       FROM hr_labor_contracts c
       LEFT JOIN hr_doc_wallet w ON w.id = c.document_id AND w.deleted_at IS NULL
       WHERE c.staff_id = $1
       ORDER BY c.effective_on DESC NULLS LAST, c.id DESC`,
      [staffId],
    );
    const rows: HrLaborContractRow[] = [];
    for (const row of result.rows) {
      const id = Number((row as Record<string, unknown>).id);
      rows.push(this.mapContract(row as Record<string, unknown>, await this.listAppendices(id)));
    }
    return rows;
  }

  async getById(staffId: number, contractId: number): Promise<HrLaborContractRow | null> {
    const result = await this.db.query(
      `SELECT ${CONTRACT_SELECT}
       FROM hr_labor_contracts c
       LEFT JOIN hr_doc_wallet w ON w.id = c.document_id AND w.deleted_at IS NULL
       WHERE c.id = $1 AND c.staff_id = $2
       LIMIT 1`,
      [contractId, staffId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return this.mapContract(row as Record<string, unknown>, await this.listAppendices(contractId));
  }

  async getActiveSummary(staffId: number): Promise<HrLaborContractSummary | null> {
    const result = await this.db.query(
      `SELECT id::int, contract_no, kind, status, effective_on::text, expires_on::text
       FROM hr_labor_contracts
       WHERE staff_id = $1 AND status = 'active'
       ORDER BY effective_on DESC NULLS LAST, id DESC
       LIMIT 1`,
      [staffId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const kind = String(row.kind ?? 'fixed');
    const expiresOn = row.expires_on ? String(row.expires_on).slice(0, 10) : null;
    return {
      id: Number(row.id),
      contract_no: String(row.contract_no ?? ''),
      kind: kind as HrLaborContractSummary['kind'],
      status: String(row.status ?? 'active') as HrLaborContractSummary['status'],
      effective_on: row.effective_on ? String(row.effective_on).slice(0, 10) : null,
      expires_on: expiresOn,
      expiring_soon: isContractExpiringSoon(expiresOn, kind),
    };
  }

  private async assertWalletCard(staffId: number, documentId: number | null | undefined): Promise<void> {
    if (documentId == null) return;
    const result = await this.db.query(
      `SELECT 1 FROM hr_doc_wallet WHERE id = $1 AND staff_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [documentId, staffId],
    );
    if (!result.rows[0]) {
      throw new BadRequestException({ error: 'invalid_document_id', document_id: documentId });
    }
  }

  private async assertUniqueContractNo(contractNo: string, excludeId?: number): Promise<void> {
    const no = String(contractNo ?? '').trim();
    if (!no) return;
    const result = await this.db.query(
      `SELECT id::int FROM hr_labor_contracts WHERE contract_no = $1 AND ($2::bigint IS NULL OR id <> $2) LIMIT 1`,
      [no, excludeId ?? null],
    );
    if (result.rows[0]) {
      throw new BadRequestException({ error: 'contract_no_duplicate', contract_no: no });
    }
  }

  private async supersedeOtherActive(staffId: number, keepId: number): Promise<void> {
    await this.db.query(
      `UPDATE hr_labor_contracts
       SET status = 'superseded', updated_at = NOW()
       WHERE staff_id = $1 AND status = 'active' AND id <> $2`,
      [staffId, keepId],
    );
  }

  async create(staffId: number, body: CreateHrLaborContractBody): Promise<HrLaborContractRow> {
    const contractNo = String(body.contract_no ?? '').trim();
    await this.assertUniqueContractNo(contractNo);
    await this.assertWalletCard(staffId, body.document_id ?? null);
    const kind = String(body.kind ?? 'fixed');
    const status = String(body.status ?? 'draft');
    if (kind === 'indefinite' && body.expires_on) {
      throw new BadRequestException({ error: 'indefinite_no_expires_on' });
    }
    const result = await this.db.query(
      `INSERT INTO hr_labor_contracts
         (staff_id, contract_no, kind, signed_on, effective_on, expires_on, salary_gross, currency,
          work_place, job_title_legal, status, document_id, notes)
       VALUES ($1, $2, $3, $4::date, $5::date, $6::date, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id::int`,
      [
        staffId,
        contractNo,
        kind,
        body.signed_on || null,
        body.effective_on || null,
        kind === 'indefinite' ? null : body.expires_on || null,
        body.salary_gross ?? null,
        String(body.currency ?? 'VND'),
        String(body.work_place ?? ''),
        String(body.job_title_legal ?? ''),
        status,
        body.document_id ?? null,
        String(body.notes ?? ''),
      ],
    );
    const id = Number((result.rows[0] as Record<string, unknown>).id);
    if (status === 'active') await this.supersedeOtherActive(staffId, id);
    const row = await this.getById(staffId, id);
    if (!row) throw new NotFoundException({ error: 'contract_not_found', id });
    return row;
  }

  async patch(staffId: number, contractId: number, body: PatchHrLaborContractBody): Promise<HrLaborContractRow> {
    const existing = await this.getById(staffId, contractId);
    if (!existing) throw new NotFoundException({ error: 'contract_not_found', id: contractId });
    const contractNo = body.contract_no !== undefined ? String(body.contract_no).trim() : existing.contract_no;
    await this.assertUniqueContractNo(contractNo, contractId);
    if (body.document_id !== undefined) await this.assertWalletCard(staffId, body.document_id);
    const kind = body.kind ?? existing.kind;
    const status = body.status ?? existing.status;
    if (kind === 'indefinite' && body.expires_on) {
      throw new BadRequestException({ error: 'indefinite_no_expires_on' });
    }
    await this.db.query(
      `UPDATE hr_labor_contracts SET
         contract_no = $3,
         kind = $4,
         signed_on = COALESCE($5::date, signed_on),
         effective_on = COALESCE($6::date, effective_on),
         expires_on = CASE WHEN $4 = 'indefinite' THEN NULL ELSE COALESCE($7::date, expires_on) END,
         salary_gross = COALESCE($8, salary_gross),
         currency = COALESCE($9, currency),
         work_place = COALESCE($10, work_place),
         job_title_legal = COALESCE($11, job_title_legal),
         status = $12,
         document_id = COALESCE($13, document_id),
         notes = COALESCE($14, notes),
         updated_at = NOW()
       WHERE id = $1 AND staff_id = $2`,
      [
        contractId,
        staffId,
        contractNo,
        kind,
        body.signed_on ?? null,
        body.effective_on ?? null,
        body.expires_on ?? null,
        body.salary_gross ?? null,
        body.currency ?? null,
        body.work_place ?? null,
        body.job_title_legal ?? null,
        status,
        body.document_id ?? null,
        body.notes ?? null,
      ],
    );
    if (status === 'active') await this.supersedeOtherActive(staffId, contractId);
    const row = await this.getById(staffId, contractId);
    if (!row) throw new NotFoundException({ error: 'contract_not_found', id: contractId });
    return row;
  }

  async createAppendix(
    staffId: number,
    contractId: number,
    body: CreateHrLaborAppendixBody,
  ): Promise<HrLaborContractAppendixRow> {
    const contract = await this.getById(staffId, contractId);
    if (!contract) throw new NotFoundException({ error: 'contract_not_found', id: contractId });
    await this.assertWalletCard(staffId, body.document_id ?? null);
    const result = await this.db.query(
      `INSERT INTO hr_labor_contract_appendices
         (contract_id, appendix_no, signed_on, effective_on, summary, salary_gross, document_id)
       VALUES ($1, $2, $3::date, $4::date, $5, $6, $7)
       RETURNING id::int`,
      [
        contractId,
        String(body.appendix_no ?? ''),
        body.signed_on || null,
        body.effective_on || null,
        String(body.summary ?? ''),
        body.salary_gross ?? null,
        body.document_id ?? null,
      ],
    );
    const id = Number((result.rows[0] as Record<string, unknown>).id);
    const appendices = await this.listAppendices(contractId);
    const row = appendices.find((a) => a.id === id);
    if (!row) throw new NotFoundException({ error: 'appendix_not_found', id });
    return row;
  }

  async patchAppendix(
    staffId: number,
    contractId: number,
    appendixId: number,
    body: PatchHrLaborAppendixBody,
  ): Promise<HrLaborContractAppendixRow> {
    const contract = await this.getById(staffId, contractId);
    if (!contract) throw new NotFoundException({ error: 'contract_not_found', id: contractId });
    if (body.document_id !== undefined) await this.assertWalletCard(staffId, body.document_id);
    const result = await this.db.query(
      `UPDATE hr_labor_contract_appendices SET
         appendix_no = COALESCE($3, appendix_no),
         signed_on = COALESCE($4::date, signed_on),
         effective_on = COALESCE($5::date, effective_on),
         summary = COALESCE($6, summary),
         salary_gross = COALESCE($7, salary_gross),
         document_id = COALESCE($8, document_id),
         updated_at = NOW()
       WHERE id = $1 AND contract_id = $2
       RETURNING id::int`,
      [
        appendixId,
        contractId,
        body.appendix_no ?? null,
        body.signed_on ?? null,
        body.effective_on ?? null,
        body.summary ?? null,
        body.salary_gross ?? null,
        body.document_id ?? null,
      ],
    );
    if (!result.rows[0]) throw new NotFoundException({ error: 'appendix_not_found', id: appendixId });
    const appendices = await this.listAppendices(contractId);
    const row = appendices.find((a) => a.id === appendixId);
    if (!row) throw new NotFoundException({ error: 'appendix_not_found', id: appendixId });
    return row;
  }
}
