import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { GtmRepository } from './gtm.repository';
import type { ListGtmDemoQuery } from './gtm.types';

@Injectable()
export class GtmExportService {
  constructor(private readonly repo: GtmRepository) {}

  async exportDemoRequestsXlsx(query: ListGtmDemoQuery): Promise<Buffer> {
    const { rows } = await this.repo.list({ ...query, limit: 5000, offset: 0 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('demo_requests');
    ws.addRow([
      'created_at',
      'full_name',
      'email',
      'phone',
      'company',
      'industry',
      'sku_interest',
      'locale',
      'market_country',
      'status',
      'utm_campaign',
      'owner_user_id',
      'sandbox_expires_at',
    ]);
    for (const r of rows) {
      ws.addRow([
        r.created_at,
        r.full_name,
        r.email,
        r.phone,
        r.company,
        r.industry,
        r.sku_interest,
        r.locale,
        r.market_country,
        r.status,
        r.utm_campaign,
        r.owner_user_id,
        r.sandbox_expires_at,
      ]);
    }
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }
}
