import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import {
  PRICE_LIST_STATUS_LABELS,
  PRICE_LIST_STATUSES,
  type RePriceListRow,
  type SavePriceListBody,
} from './re-projects.types';

@Injectable()
export class ReProjectsPriceListPgRepository implements OnModuleDestroy {
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

  private mapRow(row: Record<string, unknown>): RePriceListRow {
    let st = String(row.status ?? 'draft');
    if (!(PRICE_LIST_STATUSES as readonly string[]).includes(st)) st = 'draft';
    return {
      id: Number(row.id),
      project_id: Number(row.project_id),
      version_code: String(row.version_code ?? ''),
      name: String(row.name ?? ''),
      effective_date: String(row.effective_date ?? ''),
      status: st,
      status_label: PRICE_LIST_STATUS_LABELS[st] ?? st,
      notes: String(row.notes ?? ''),
      applied_at: String(row.applied_at ?? ''),
      applied_by: String(row.applied_by ?? ''),
      created_by: String(row.created_by ?? ''),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ''),
      item_count: Number(row.item_count ?? 0),
    };
  }

  async listPriceLists(projectId: number): Promise<RePriceListRow[]> {
    const res = await this.db.query(
      `SELECT pl.*,
              (SELECT COUNT(*)::int FROM crm_re_price_list_items i WHERE i.price_list_id = pl.id) AS item_count
       FROM crm_re_price_lists pl
       WHERE pl.project_id = $1
       ORDER BY pl.effective_date DESC, pl.updated_at DESC, pl.id DESC`,
      [projectId],
    );
    return res.rows.map((r) => this.mapRow(r as Record<string, unknown>));
  }

  async listAllVersionCodes(projectId: number): Promise<string[]> {
    const res = await this.db.query(
      `SELECT version_code FROM crm_re_price_lists WHERE project_id = $1 AND trim(version_code) <> ''`,
      [projectId],
    );
    return res.rows.map((r) => String(r.version_code));
  }

  async fetchPriceList(projectId: number, listId: number): Promise<RePriceListRow | null> {
    const res = await this.db.query(
      `SELECT pl.*,
              (SELECT COUNT(*)::int FROM crm_re_price_list_items i WHERE i.price_list_id = pl.id) AS item_count
       FROM crm_re_price_lists pl
       WHERE pl.id = $1 AND pl.project_id = $2`,
      [listId, projectId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  async listPriceListItems(priceListId: number, limit = 500, offset = 0): Promise<{
    items: Array<Record<string, unknown>>;
    total: number;
  }> {
    const lim = Math.max(1, Math.min(limit, 2000));
    const off = Math.max(0, offset);
    const totalRes = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM crm_re_price_list_items WHERE price_list_id = $1`,
      [priceListId],
    );
    const total = Number(totalRes.rows[0]?.c ?? 0);
    const res = await this.db.query(
      `SELECT * FROM crm_re_price_list_items
       WHERE price_list_id = $1
       ORDER BY lower(unit_code)
       LIMIT $2 OFFSET $3`,
      [priceListId, lim, off],
    );
    const items = res.rows.map((d) => ({
      id: Number(d.id),
      price_list_id: Number(d.price_list_id),
      unit_code: String(d.unit_code ?? ''),
      zone: String(d.zone ?? ''),
      list_price_vnd: Number(d.list_price_vnd ?? 0),
      net_price_vnd: Number(d.net_price_vnd ?? 0),
      notes: String(d.notes ?? ''),
      created_at: d.created_at instanceof Date ? d.created_at.toISOString() : String(d.created_at ?? ''),
      updated_at: d.updated_at instanceof Date ? d.updated_at.toISOString() : String(d.updated_at ?? ''),
    }));
    return { items, total };
  }

  async savePriceList(
    projectId: number,
    payload: SavePriceListBody,
    listId?: number,
    createdBy = '',
  ): Promise<RePriceListRow> {
    const proj = await this.db.query(`SELECT 1 FROM crm_re_projects WHERE id = $1`, [projectId]);
    if (!proj.rows[0]) throw new Error('Không tìm thấy dự án.');
    const versionCode = String(payload.version_code ?? payload.code ?? '').trim().slice(0, 80);
    if (!versionCode) throw new Error('Thiếu mã version (version_code).');
    const name = String(payload.name ?? versionCode).trim().slice(0, 200);
    const effectiveDate = String(payload.effective_date ?? '').trim().slice(0, 10);
    const notes = String(payload.notes ?? '').slice(0, 2000);
    let rid: number;
    if (listId) {
      const existing = await this.fetchPriceList(projectId, listId);
      if (!existing) throw new Error('Không tìm thấy bảng giá.');
      if (existing.status === 'active' && payload.version_code) {
        const dup = await this.db.query(
          `SELECT id FROM crm_re_price_lists
           WHERE project_id = $1 AND lower(trim(version_code)) = lower($2) AND id != $3`,
          [projectId, versionCode, listId],
        );
        if (dup.rows[0]) throw new Error(`Mã version «${versionCode}» đã tồn tại.`);
      }
      let status = existing.status;
      if (payload.status != null) {
        const newSt = String(payload.status).trim().toLowerCase();
        if (!(PRICE_LIST_STATUSES as readonly string[]).includes(newSt)) {
          throw new Error(`Trạng thái không hợp lệ: ${payload.status}`);
        }
        if (newSt === 'active' && existing.status !== 'active') {
          throw new Error('Dùng «Áp dụng bảng giá» để kích hoạt — không đổi status trực tiếp.');
        }
        if (existing.status !== 'active') status = newSt;
      }
      await this.db.query(
        `UPDATE crm_re_price_lists SET
           version_code = $3, name = $4, effective_date = $5, status = $6, notes = $7, updated_at = NOW()
         WHERE id = $1 AND project_id = $2`,
        [listId, projectId, versionCode, name, effectiveDate, status, notes],
      );
      rid = listId;
    } else {
      const dup = await this.db.query(
        `SELECT id FROM crm_re_price_lists
         WHERE project_id = $1 AND lower(trim(version_code)) = lower($2)`,
        [projectId, versionCode],
      );
      if (dup.rows[0]) throw new Error(`Mã version «${versionCode}» đã tồn tại.`);
      const tenantRes = await this.db.query(
        `SELECT tenant_id FROM crm_re_projects WHERE id = $1`,
        [projectId],
      );
      const tenantId = tenantRes.rows[0]?.tenant_id ?? null;
      const ins = await this.db.query(
        `INSERT INTO crm_re_price_lists (
           project_id, tenant_id, version_code, name, effective_date, status, notes, created_by
         ) VALUES ($1,$2,$3,$4,$5,'draft',$6,$7)
         RETURNING id`,
        [projectId, tenantId, versionCode, name, effectiveDate, notes, String(createdBy).slice(0, 120)],
      );
      rid = Number(ins.rows[0].id);
    }
    const out = await this.fetchPriceList(projectId, rid);
    if (!out) throw new Error('Không tìm thấy bảng giá sau khi lưu.');
    return out;
  }

  async deletePriceList(projectId: number, listId: number): Promise<void> {
    const row = await this.fetchPriceList(projectId, listId);
    if (!row) throw new Error('Không tìm thấy bảng giá.');
    if (row.status === 'active') throw new Error('Không xóa bảng giá đang áp dụng.');
    await this.db.query(`DELETE FROM crm_re_price_lists WHERE id = $1 AND project_id = $2`, [
      listId,
      projectId,
    ]);
  }
}
