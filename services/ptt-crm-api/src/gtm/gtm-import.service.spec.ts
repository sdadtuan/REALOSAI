import ExcelJS from 'exceljs';
import { GtmImportService } from './gtm-import.service';

describe('GtmImportService', () => {
  it('imports happy path and skips deduped email', async () => {
    const repo = {
      findLeadIdByEmailSince: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('99'),
      insert: jest.fn().mockResolvedValue({ id: 'r1' }),
    };
    const leads = {
      createLead: jest.fn().mockResolvedValue({ id: 42 }),
    };
    const svc = new GtmImportService(repo as never, leads as never);

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('import');
    ws.addRow(['full_name', 'email', 'phone', 'company', 'industry', 'sku_interest', 'notes']);
    ws.addRow(['Nguyen An', 'an@agency.vn', '0901234567', 'An Agency', 'agency', 'agy', '']);
    ws.addRow(['Dup', 'an@agency.vn', '0901234568', 'An Agency', 'agency', 'agy', '']);
    const buf = Buffer.from(await workbook.xlsx.writeBuffer());

    const out = await svc.importDemoRows(buf, 'test-salt');
    expect(out.imported).toBe(1);
    expect(out.skipped).toBe(1);
    expect(out.errors).toHaveLength(0);
  });

  it('reports bad row errors', async () => {
    const repo = { findLeadIdByEmailSince: jest.fn(), insert: jest.fn() };
    const leads = { createLead: jest.fn() };
    const svc = new GtmImportService(repo as never, leads as never);

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('import');
    ws.addRow(['full_name', 'email', 'phone', 'company', 'industry', 'sku_interest']);
    ws.addRow(['A', 'bad-email', '0901234567', 'Co', 'agency', 'agy']);
    const buf = Buffer.from(await workbook.xlsx.writeBuffer());

    const out = await svc.importDemoRows(buf, 'test-salt');
    expect(out.skipped).toBeGreaterThanOrEqual(1);
    expect(out.errors.length).toBeGreaterThanOrEqual(1);
  });
});
