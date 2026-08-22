import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PgLeadsWriteRepository } from '../leads/pg-leads-write.repository';
import { hashGtmIp } from './gtm-ip.util';
import { GtmRepository } from './gtm.repository';
import { validatePublicDemoBody } from './gtm-validate.util';

export type GtmImportResult = {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

@Injectable()
export class GtmImportService {
  constructor(
    private readonly repo: GtmRepository,
    private readonly leads: PgLeadsWriteRepository,
  ) {}

  async importDemoRows(buffer: Buffer, ipSalt: string): Promise<GtmImportResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(buffer) as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    if (!ws) return { imported: 0, skipped: 0, errors: [{ row: 0, message: 'empty_workbook' }] };

    const header = (ws.getRow(1).values as unknown[]).slice(1).map(String);
    const required = ['full_name', 'email', 'phone', 'company', 'industry', 'sku_interest'];
    for (const col of required) {
      if (!header.includes(col)) {
        return { imported: 0, skipped: 0, errors: [{ row: 1, message: `missing_column_${col}` }] };
      }
    }

    const idx = (name: string) => header.indexOf(name);
    let imported = 0;
    let skipped = 0;
    const errors: GtmImportResult['errors'] = [];

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const row = ws.getRow(r);
      const val = (col: string) => String(row.getCell(idx(col) + 1).value ?? '').trim();
      if (!val('email')) continue;

      const body = {
        full_name: val('full_name'),
        email: val('email'),
        phone: val('phone'),
        company: val('company'),
        industry: val('industry'),
        sku_interest: val('sku_interest'),
        consent_privacy: true,
        locale: 'vi' as const,
        landing_path: '/import',
        website: '',
      };
      const v = validatePublicDemoBody(body);
      if (!v.ok) {
        errors.push({ row: r, message: Object.keys(v.field_errors).join(',') });
        skipped += 1;
        continue;
      }

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const existingLead = await this.repo.findLeadIdByEmailSince(v.value.email, since);
      if (existingLead) {
        skipped += 1;
        continue;
      }

      const lead = await this.leads.createLead({
        full_name: v.value.full_name,
        email: v.value.email,
        phone: v.value.phone,
        source: 'pttcrm_import',
        channel: 'import',
        lead_flow_kind: 'b2b_prospect',
        meta: { company: v.value.company, notes: val('notes') || undefined },
      });

      await this.repo.insert({
        ...v.value,
        message: val('notes') || undefined,
        ip_hash: hashGtmIp('import', ipSalt),
        lead_id: String(lead.id),
        owner_user_id: null,
      });
      imported += 1;
    }

    return { imported, skipped, errors };
  }
}
