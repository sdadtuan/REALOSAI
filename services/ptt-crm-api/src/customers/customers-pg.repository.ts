import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { catalogTs } from '../catalog/catalog-slug.util';
import { AppConfigService } from '../config/app-config.service';
import {
  mapCustomerRow,
  mapIssueRow,
  mapPurchaseRow,
  mapRelationRow,
} from './customers-pg.mapper';
import {
  CreateCustomerBody,
  CreateIssueBody,
  CreatePurchaseBody,
  CreateRelationBody,
  CUSTOMER_GENDERS,
  CUSTOMER_LEAD_SOURCES,
  CustomerBriefRow,
  CustomerDetailStats,
  CustomerIssueRow,
  CustomerPurchaseRow,
  CustomerRelationRow,
  CustomerRow,
  normalizeIssuePriority,
  normalizeIssueStatus,
  normalizeIssueType,
  normalizePurchaseStatus,
  normalizeRelationType,
  PatchCustomerBody,
  PatchIssueBody,
  PatchPurchaseBody,
  PatchRelationBody,
  PROFILE_PATCH_KEYS,
} from './customers.types';

const CUSTOMER_SELECT = `
  id, sqlite_customer_id, name, phone, email, address, company,
  lead_source, lead_source_note, date_of_birth, gender, id_number,
  occupation, interests, profile_notes, created_at`;

@Injectable()
export class CustomersPgRepository implements OnModuleDestroy {
  private pool: Pool | null = null;

  constructor(private readonly config: AppConfigService) {}

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

  private async resolveCustomerPgId(
    legacyId: number,
  ): Promise<{ pgId: number; legacyId: number } | null> {
    const result = await this.db.query(
      `SELECT id, sqlite_customer_id FROM crm_customers
       WHERE sqlite_customer_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_customer_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [legacyId],
    );
    const row = result.rows[0] as { id?: unknown; sqlite_customer_id?: unknown } | undefined;
    if (!row?.id) return null;
    const pgId = Number(row.id);
    const resolvedLegacyId = Number(row.sqlite_customer_id ?? row.id);
    return { pgId, legacyId: resolvedLegacyId };
  }

  private normalizeLeadSource(raw: string): string {
    const code = String(raw ?? '').trim().toLowerCase();
    if ((CUSTOMER_LEAD_SOURCES as readonly string[]).includes(code)) return code;
    return code ? 'other' : '';
  }

  private normalizeGender(raw: string): string {
    const code = String(raw ?? '').trim().toLowerCase();
    return (CUSTOMER_GENDERS as readonly string[]).includes(code) ? code : '';
  }

  async listCustomers(q?: string, limit = 200): Promise<CustomerRow[]> {
    const lim = Math.max(1, Math.min(limit, 500));
    const qRaw = String(q ?? '').trim().toLowerCase();

    let result;
    if (qRaw) {
      const like = `%${qRaw}%`;
      result = await this.db.query(
        `SELECT ${CUSTOMER_SELECT}
         FROM crm_customers
         WHERE is_placeholder IS NOT TRUE
           AND (
             lower(trim(coalesce(name, ''))) LIKE $1
             OR lower(trim(coalesce(phone, ''))) LIKE $1
             OR lower(trim(coalesce(email, ''))) LIKE $1
             OR lower(trim(coalesce(address, ''))) LIKE $1
             OR lower(trim(coalesce(company, ''))) LIKE $1
           )
         ORDER BY id DESC
         LIMIT $2`,
        [like, lim],
      );
    } else {
      result = await this.db.query(
        `SELECT ${CUSTOMER_SELECT}
         FROM crm_customers
         WHERE is_placeholder IS NOT TRUE
         ORDER BY id DESC
         LIMIT $1`,
        [lim],
      );
    }
    return (result.rows as Array<Record<string, unknown>>).map((row) => mapCustomerRow(row));
  }

  async findLinkedLeadIds(customerId: number): Promise<number[]> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) {
      return [];
    }
    const { pgId } = resolved;
    const customer = await this.getCustomerById(customerId);
    if (!customer) {
      return [];
    }
    const ids = new Set<number>();
    const phone = String(customer.phone ?? '').trim();
    const email = String(customer.email ?? '').trim().toLowerCase();

    const placeholderResult = await this.db.query(
      `SELECT placeholder_lead_id FROM crm_customers WHERE id = $1 LIMIT 1`,
      [pgId],
    );
    const placeholder = placeholderResult.rows[0] as { placeholder_lead_id?: unknown } | undefined;
    if (placeholder?.placeholder_lead_id && Number(placeholder.placeholder_lead_id) > 0) {
      ids.add(Number(placeholder.placeholder_lead_id));
    }

    if (phone) {
      const phoneResult = await this.db.query(
        `SELECT COALESCE(sqlite_lead_id, id) AS lead_id FROM crm_leads
         WHERE trim(coalesce(phone, '')) = $1
         ORDER BY id DESC
         LIMIT 20`,
        [phone],
      );
      for (const row of phoneResult.rows as Array<{ lead_id: unknown }>) {
        ids.add(Number(row.lead_id));
      }
    }

    if (email) {
      const emailResult = await this.db.query(
        `SELECT COALESCE(sqlite_lead_id, id) AS lead_id FROM crm_leads
         WHERE lower(trim(coalesce(email, ''))) = $1
         ORDER BY id DESC
         LIMIT 20`,
        [email],
      );
      for (const row of emailResult.rows as Array<{ lead_id: unknown }>) {
        ids.add(Number(row.lead_id));
      }
    }

    try {
      const lifecycleResult = await this.db.query(
        `SELECT lead_id FROM crm_service_lifecycle
         WHERE customer_id = $1 AND lead_id IS NOT NULL
         ORDER BY id DESC
         LIMIT 20`,
        [pgId],
      );
      for (const row of lifecycleResult.rows as Array<{ lead_id: unknown }>) {
        if (Number(row.lead_id) > 0) {
          ids.add(Number(row.lead_id));
        }
      }
    } catch {
      /* lifecycle table optional in older DBs */
    }

    return [...ids];
  }

  async getCustomerById(id: number): Promise<CustomerRow | null> {
    const result = await this.db.query(
      `SELECT ${CUSTOMER_SELECT} FROM crm_customers
       WHERE sqlite_customer_id = $1 OR id = $1
       ORDER BY CASE WHEN sqlite_customer_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? mapCustomerRow(row) : null;
  }

  async createCustomer(body: CreateCustomerBody): Promise<CustomerRow> {
    const ts = catalogTs();
    const leadSource = this.normalizeLeadSource(body.lead_source ?? '');
    const insert = await this.db.query(
      `INSERT INTO crm_customers (
         name, phone, email, address, company, lead_source, lead_source_note,
         date_of_birth, gender, id_number, occupation, interests, profile_notes, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::timestamptz)
       RETURNING id`,
      [
        String(body.name ?? '').trim().slice(0, 240),
        String(body.phone ?? '').trim().slice(0, 64),
        String(body.email ?? '').trim().slice(0, 240),
        String(body.address ?? '').trim().slice(0, 500),
        String(body.company ?? '').trim().slice(0, 240),
        leadSource,
        String(body.lead_source_note ?? '').trim().slice(0, 4000),
        String(body.date_of_birth ?? '').trim().slice(0, 32),
        this.normalizeGender(body.gender ?? ''),
        String(body.id_number ?? '').trim().slice(0, 32),
        String(body.occupation ?? '').trim().slice(0, 240),
        String(body.interests ?? '').trim().slice(0, 4000),
        String(body.profile_notes ?? '').trim().slice(0, 4000),
        ts,
      ],
    );
    const pgId = Number(insert.rows[0]?.id);
    await this.db.query(
      `UPDATE crm_customers SET sqlite_customer_id = id
       WHERE id = $1 AND sqlite_customer_id IS NULL`,
      [pgId],
    );
    const created = await this.getCustomerById(pgId);
    if (!created) {
      throw new Error('Failed to create customer');
    }
    return created;
  }

  async patchCustomer(id: number, body: PatchCustomerBody): Promise<CustomerRow | null> {
    const resolved = await this.resolveCustomerPgId(id);
    if (!resolved) return null;
    const { pgId } = resolved;

    const existingResult = await this.db.query(`SELECT * FROM crm_customers WHERE id = $1`, [
      pgId,
    ]);
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;

    const merged: Record<string, string> = {
      name: String(existing.name ?? ''),
      phone: String(existing.phone ?? ''),
      email: String(existing.email ?? ''),
      address: String(existing.address ?? ''),
      company: String(existing.company ?? ''),
      lead_source: String(existing.lead_source ?? ''),
      lead_source_note: String(existing.lead_source_note ?? ''),
      date_of_birth: String(existing.date_of_birth ?? ''),
      gender: String(existing.gender ?? ''),
      id_number: String(existing.id_number ?? ''),
      occupation: String(existing.occupation ?? ''),
      interests: String(existing.interests ?? ''),
      profile_notes: String(existing.profile_notes ?? ''),
    };

    for (const key of PROFILE_PATCH_KEYS) {
      if (!(key in body)) continue;
      const val = body[key];
      if (val === null || val === undefined) {
        merged[key] = '';
        continue;
      }
      if (typeof val !== 'string') continue;
      const s = val.trim();
      if (key === 'phone') merged[key] = s.slice(0, 64);
      else if (key === 'address') merged[key] = s.slice(0, 500);
      else if (key === 'interests' || key === 'profile_notes' || key === 'lead_source_note') {
        merged[key] = s.slice(0, 4000);
      } else if (key === 'id_number' || key === 'date_of_birth') merged[key] = s.slice(0, 32);
      else if (key === 'lead_source') merged[key] = s ? this.normalizeLeadSource(s) : '';
      else if (key === 'gender') merged[key] = s ? this.normalizeGender(s) : '';
      else merged[key] = s.slice(0, 240);
    }

    await this.db.query(
      `UPDATE crm_customers
       SET name = $1, phone = $2, email = $3, address = $4, company = $5,
           lead_source = $6, lead_source_note = $7, date_of_birth = $8, gender = $9,
           id_number = $10, occupation = $11, interests = $12, profile_notes = $13
       WHERE id = $14`,
      [
        merged.name,
        merged.phone,
        merged.email,
        merged.address,
        merged.company,
        merged.lead_source,
        merged.lead_source_note,
        merged.date_of_birth,
        merged.gender,
        merged.id_number,
        merged.occupation,
        merged.interests,
        merged.profile_notes,
        pgId,
      ],
    );
    return this.getCustomerById(resolved.legacyId);
  }

  async fetchRelations(customerId: number): Promise<CustomerRelationRow[]> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return [];
    const result = await this.db.query(
      `SELECT * FROM crm_customer_relations
       WHERE customer_id = $1
       ORDER BY id ASC`,
      [resolved.pgId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) =>
      mapRelationRow(row, resolved.legacyId),
    );
  }

  async fetchPurchases(customerId: number): Promise<CustomerPurchaseRow[]> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return [];
    const result = await this.db.query(
      `SELECT * FROM crm_customer_purchases
       WHERE customer_id = $1
       ORDER BY COALESCE(NULLIF(order_date, ''), created_at::text) DESC, id DESC`,
      [resolved.pgId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) =>
      mapPurchaseRow(row, resolved.legacyId),
    );
  }

  async fetchIssues(customerId: number): Promise<CustomerIssueRow[]> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return [];
    const result = await this.db.query(
      `SELECT i.*, st.name AS assigned_staff_name
       FROM crm_customer_issues i
       LEFT JOIN crm_staff st ON st.id = i.assigned_staff_id
       WHERE i.customer_id = $1
       ORDER BY CASE i.status WHEN 'moi' THEN 0 WHEN 'dang_xu_ly' THEN 1 WHEN 'cho_khach' THEN 2 ELSE 9 END,
                i.id DESC`,
      [resolved.pgId],
    );
    return (result.rows as Array<Record<string, unknown>>).map((row) =>
      mapIssueRow(row, resolved.legacyId),
    );
  }

  computeStats(
    relations: CustomerRelationRow[],
    purchases: CustomerPurchaseRow[],
    issues: CustomerIssueRow[],
  ): CustomerDetailStats {
    const issuesOpen = issues.filter(
      (i) => !['da_xu_ly', 'dong'].includes(String(i.status ?? '')),
    ).length;
    return {
      relations_total: relations.length,
      purchases_total: purchases.length,
      issues_total: issues.length,
      issues_open: issuesOpen,
    };
  }

  async createRelation(
    customerId: number,
    body: CreateRelationBody,
  ): Promise<CustomerRelationRow> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) {
      throw new Error('Customer not found');
    }
    const ts = catalogTs();
    const insert = await this.db.query(
      `INSERT INTO crm_customer_relations (
         customer_id, relation_type, full_name, phone, email, notes, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $7::timestamptz)
       RETURNING id`,
      [
        resolved.pgId,
        normalizeRelationType(body.relation_type),
        String(body.full_name ?? '').trim().slice(0, 240),
        String(body.phone ?? '').trim().slice(0, 64),
        String(body.email ?? '').trim().slice(0, 240),
        String(body.notes ?? '').trim().slice(0, 2000),
        ts,
      ],
    );
    const relationPgId = Number(insert.rows[0]?.id);
    await this.db.query(
      `UPDATE crm_customer_relations SET sqlite_relation_id = id
       WHERE id = $1 AND sqlite_relation_id IS NULL`,
      [relationPgId],
    );
    const rowResult = await this.db.query(`SELECT * FROM crm_customer_relations WHERE id = $1`, [
      relationPgId,
    ]);
    return mapRelationRow(rowResult.rows[0] as Record<string, unknown>, resolved.legacyId);
  }

  async patchRelation(
    customerId: number,
    relationId: number,
    body: PatchRelationBody,
  ): Promise<CustomerRelationRow | null> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return null;

    const existingResult = await this.db.query(
      `SELECT * FROM crm_customer_relations
       WHERE customer_id = $1 AND (sqlite_relation_id = $2 OR id = $2)
       ORDER BY CASE WHEN sqlite_relation_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [resolved.pgId, relationId],
    );
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;
    const relationPgId = Number(existing.id);

    const merged: Record<string, string> = {
      relation_type: String(existing.relation_type ?? ''),
      full_name: String(existing.full_name ?? ''),
      phone: String(existing.phone ?? ''),
      email: String(existing.email ?? ''),
      notes: String(existing.notes ?? ''),
    };
    if ('relation_type' in body) {
      merged.relation_type = normalizeRelationType(body.relation_type);
    }
    for (const key of ['full_name', 'phone', 'email', 'notes'] as const) {
      if (key in body && typeof body[key] === 'string') {
        merged[key] = body[key]!.trim().slice(key === 'notes' ? 0 : 240);
      }
    }
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_customer_relations
       SET relation_type = $1, full_name = $2, phone = $3, email = $4, notes = $5, updated_at = $6::timestamptz
       WHERE id = $7`,
      [
        merged.relation_type,
        merged.full_name,
        merged.phone,
        merged.email,
        merged.notes,
        ts,
        relationPgId,
      ],
    );
    const rowResult = await this.db.query(`SELECT * FROM crm_customer_relations WHERE id = $1`, [
      relationPgId,
    ]);
    return mapRelationRow(rowResult.rows[0] as Record<string, unknown>, resolved.legacyId);
  }

  async deleteRelation(customerId: number, relationId: number): Promise<boolean> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return false;
    const result = await this.db.query(
      `DELETE FROM crm_customer_relations
       WHERE customer_id = $1 AND (sqlite_relation_id = $2 OR id = $2)`,
      [resolved.pgId, relationId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async createPurchase(
    customerId: number,
    body: CreatePurchaseBody,
  ): Promise<CustomerPurchaseRow> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) {
      throw new Error('Customer not found');
    }
    const ts = catalogTs();
    let amount = 0;
    try {
      amount = Math.max(0, Number(body.amount_vnd ?? 0));
    } catch {
      amount = 0;
    }
    let qty = 1;
    try {
      qty = Math.max(1, Number(body.quantity ?? 1));
    } catch {
      qty = 1;
    }
    let contractId: number | null = null;
    if (body.contract_id != null && body.contract_id !== 0) {
      contractId = Number(body.contract_id);
      if (!Number.isFinite(contractId)) contractId = null;
    }
    const insert = await this.db.query(
      `INSERT INTO crm_customer_purchases (
         customer_id, order_date, product_name, amount_vnd, quantity, status,
         reference_code, notes, contract_id, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz, $10::timestamptz)
       RETURNING id`,
      [
        resolved.pgId,
        String(body.order_date ?? ts.slice(0, 10)).trim().slice(0, 32),
        String(body.product_name ?? '').trim().slice(0, 400),
        amount,
        qty,
        normalizePurchaseStatus(body.status),
        String(body.reference_code ?? '').trim().slice(0, 120),
        String(body.notes ?? '').trim().slice(0, 2000),
        contractId,
        ts,
      ],
    );
    const purchasePgId = Number(insert.rows[0]?.id);
    await this.db.query(
      `UPDATE crm_customer_purchases SET sqlite_purchase_id = id
       WHERE id = $1 AND sqlite_purchase_id IS NULL`,
      [purchasePgId],
    );
    const rowResult = await this.db.query(`SELECT * FROM crm_customer_purchases WHERE id = $1`, [
      purchasePgId,
    ]);
    return mapPurchaseRow(rowResult.rows[0] as Record<string, unknown>, resolved.legacyId);
  }

  async patchPurchase(
    customerId: number,
    purchaseId: number,
    body: PatchPurchaseBody,
  ): Promise<CustomerPurchaseRow | null> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return null;

    const existingResult = await this.db.query(
      `SELECT * FROM crm_customer_purchases
       WHERE customer_id = $1 AND (sqlite_purchase_id = $2 OR id = $2)
       ORDER BY CASE WHEN sqlite_purchase_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [resolved.pgId, purchaseId],
    );
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;
    const purchasePgId = Number(existing.id);

    const merged: Record<string, unknown> = { ...existing };
    for (const key of ['product_name', 'order_date', 'reference_code', 'notes'] as const) {
      if (key in body && typeof body[key] === 'string') {
        merged[key] = body[key]!.trim().slice(key === 'product_name' ? 0 : 2000);
      }
    }
    if ('status' in body) {
      merged.status = normalizePurchaseStatus(body.status);
    }
    if ('amount_vnd' in body) {
      try {
        merged.amount_vnd = Math.max(0, Number(body.amount_vnd ?? 0));
      } catch {
        /* keep existing */
      }
    }
    if ('quantity' in body) {
      try {
        merged.quantity = Math.max(1, Number(body.quantity ?? 1));
      } catch {
        /* keep existing */
      }
    }
    const ts = catalogTs();
    await this.db.query(
      `UPDATE crm_customer_purchases
       SET order_date = $1, product_name = $2, amount_vnd = $3, quantity = $4, status = $5,
           reference_code = $6, notes = $7, updated_at = $8::timestamptz
       WHERE id = $9`,
      [
        String(merged.order_date ?? ''),
        String(merged.product_name ?? ''),
        Number(merged.amount_vnd ?? 0),
        Number(merged.quantity ?? 1),
        String(merged.status ?? ''),
        String(merged.reference_code ?? ''),
        String(merged.notes ?? ''),
        ts,
        purchasePgId,
      ],
    );
    const rowResult = await this.db.query(`SELECT * FROM crm_customer_purchases WHERE id = $1`, [
      purchasePgId,
    ]);
    return mapPurchaseRow(rowResult.rows[0] as Record<string, unknown>, resolved.legacyId);
  }

  async deletePurchase(customerId: number, purchaseId: number): Promise<boolean> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return false;
    const result = await this.db.query(
      `DELETE FROM crm_customer_purchases
       WHERE customer_id = $1 AND (sqlite_purchase_id = $2 OR id = $2)`,
      [resolved.pgId, purchaseId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async createIssue(customerId: number, body: CreateIssueBody): Promise<CustomerIssueRow> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) {
      throw new Error('Customer not found');
    }
    const ts = catalogTs();
    let caseId: number | null = null;
    if (body.case_id != null && body.case_id !== 0) {
      caseId = Number(body.case_id);
      if (!Number.isFinite(caseId)) caseId = null;
    }
    let assignedStaffId: number | null = null;
    if (body.assigned_staff_id != null && body.assigned_staff_id !== 0) {
      assignedStaffId = Number(body.assigned_staff_id);
      if (!Number.isFinite(assignedStaffId)) assignedStaffId = null;
    }
    const insert = await this.db.query(
      `INSERT INTO crm_customer_issues (
         customer_id, case_id, issue_type, priority, status, title, description,
         resolution, assigned_staff_id, created_at, updated_at, resolved_at
       ) VALUES ($1, $2, $3, $4, 'moi', $5, $6, '', $7, $8::timestamptz, $8::timestamptz, NULL)
       RETURNING id`,
      [
        resolved.pgId,
        caseId,
        normalizeIssueType(body.issue_type),
        normalizeIssuePriority(body.priority),
        String(body.title ?? '').trim().slice(0, 400),
        String(body.description ?? '').trim().slice(0, 8000),
        assignedStaffId,
        ts,
      ],
    );
    const issuePgId = Number(insert.rows[0]?.id);
    await this.db.query(
      `UPDATE crm_customer_issues SET sqlite_issue_id = id
       WHERE id = $1 AND sqlite_issue_id IS NULL`,
      [issuePgId],
    );
    const rowResult = await this.db.query(
      `SELECT i.*, st.name AS assigned_staff_name
       FROM crm_customer_issues i
       LEFT JOIN crm_staff st ON st.id = i.assigned_staff_id
       WHERE i.id = $1`,
      [issuePgId],
    );
    return mapIssueRow(rowResult.rows[0] as Record<string, unknown>, resolved.legacyId);
  }

  async patchIssue(
    customerId: number,
    issueId: number,
    body: PatchIssueBody,
  ): Promise<CustomerIssueRow | null> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return null;

    const existingResult = await this.db.query(
      `SELECT * FROM crm_customer_issues
       WHERE customer_id = $1 AND (sqlite_issue_id = $2 OR id = $2)
       ORDER BY CASE WHEN sqlite_issue_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [resolved.pgId, issueId],
    );
    const existing = existingResult.rows[0] as Record<string, unknown> | undefined;
    if (!existing) return null;
    const issuePgId = Number(existing.id);

    const merged: Record<string, unknown> = { ...existing };
    for (const key of ['title', 'description', 'resolution'] as const) {
      if (key in body && typeof body[key] === 'string') {
        merged[key] = body[key]!.trim().slice(key === 'title' ? 0 : 8000);
      }
    }
    if ('issue_type' in body) merged.issue_type = normalizeIssueType(body.issue_type);
    if ('priority' in body) merged.priority = normalizeIssuePriority(body.priority);
    if ('status' in body) merged.status = normalizeIssueStatus(body.status);
    if ('assigned_staff_id' in body) {
      const raw = body.assigned_staff_id;
      if (raw == null || raw === 0) {
        merged.assigned_staff_id = null;
      } else {
        const aid = Number(raw);
        merged.assigned_staff_id = Number.isFinite(aid) ? aid : null;
      }
    }
    let resolvedAt = String(merged.resolved_at ?? '');
    const status = String(merged.status ?? '');
    const ts = catalogTs();
    if (['da_xu_ly', 'dong'].includes(status) && !resolvedAt) {
      resolvedAt = ts;
    } else if (!['da_xu_ly', 'dong'].includes(status)) {
      resolvedAt = '';
    }
    await this.db.query(
      `UPDATE crm_customer_issues
       SET issue_type = $1, priority = $2, status = $3, title = $4, description = $5,
           resolution = $6, assigned_staff_id = $7, updated_at = $8::timestamptz, resolved_at = $9::timestamptz
       WHERE id = $10`,
      [
        String(merged.issue_type ?? ''),
        String(merged.priority ?? ''),
        String(merged.status ?? ''),
        String(merged.title ?? ''),
        String(merged.description ?? ''),
        String(merged.resolution ?? ''),
        merged.assigned_staff_id != null ? Number(merged.assigned_staff_id) : null,
        ts,
        resolvedAt || null,
        issuePgId,
      ],
    );
    const rowResult = await this.db.query(
      `SELECT i.*, st.name AS assigned_staff_name
       FROM crm_customer_issues i
       LEFT JOIN crm_staff st ON st.id = i.assigned_staff_id
       WHERE i.id = $1`,
      [issuePgId],
    );
    return mapIssueRow(rowResult.rows[0] as Record<string, unknown>, resolved.legacyId);
  }

  async getLatestBrief(customerId: number): Promise<CustomerBriefRow | null> {
    const resolved = await this.resolveCustomerPgId(customerId);
    if (!resolved) return null;
    const result = await this.db.query(
      `SELECT id, sqlite_brief_id, customer_id, meeting_purpose, ai_output, created_at
       FROM crm_customer_brief_scans
       WHERE customer_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [resolved.pgId],
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: Number(row.sqlite_brief_id ?? row.id),
      customer_id: resolved.legacyId,
      meeting_purpose: String(row.meeting_purpose ?? ''),
      ai_output: String(row.ai_output ?? ''),
      created_at: String(row.created_at ?? ''),
    };
  }
}
