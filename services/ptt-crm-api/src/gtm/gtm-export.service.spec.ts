import ExcelJS from 'exceljs';
import { GtmExportService } from './gtm-export.service';

describe('GtmExportService', () => {
  it('exports rows to xlsx buffer', async () => {
    const repo = {
      list: jest.fn().mockResolvedValue({
        rows: [
          {
            id: '1',
            created_at: '2026-08-15T10:00:00.000Z',
            updated_at: '2026-08-15T10:00:00.000Z',
            locale: 'vi',
            full_name: 'A',
            email: 'a@b.vn',
            phone: '0901234567',
            company: 'Co',
            industry: 'agency',
            sku_interest: 'agy',
            company_size: null,
            message: null,
            landing_path: '/vi',
            utm_source: null,
            utm_medium: null,
            utm_campaign: 'spring',
            utm_content: null,
            utm_term: null,
            status: 'new',
            status_note: null,
            owner_user_id: 'u1',
            lead_id: '9',
            sandbox_expires_at: null,
            sandbox_user_id: null,
            ip_hash: 'x',
            market_country: 'th',
          },
          {
            id: '2',
            created_at: '2026-08-14T10:00:00.000Z',
            updated_at: '2026-08-14T10:00:00.000Z',
            locale: 'en',
            full_name: 'B',
            email: 'b@b.vn',
            phone: '0901234568',
            company: 'Co2',
            industry: 'bds',
            sku_interest: 'mkt',
            company_size: null,
            message: null,
            landing_path: '/en',
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            utm_content: null,
            utm_term: null,
            status: 'qualified',
            status_note: null,
            owner_user_id: null,
            lead_id: null,
            sandbox_expires_at: null,
            sandbox_user_id: null,
            ip_hash: 'y',
            market_country: null,
          },
        ],
        total: 2,
      }),
    };
    const svc = new GtmExportService(repo as never);
    const out = await svc.exportDemoRequestsXlsx({ status: 'new' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(out) as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0];
    expect(ws?.rowCount).toBe(3);
    expect(String(ws?.getRow(1).getCell(9).value)).toBe('market_country');
    expect(String(ws?.getRow(2).getCell(9).value)).toBe('th');
  });
});
