import { mapCareReportRow, mapCaseRow } from './cases-pg.mapper';

describe('cases-pg.mapper', () => {
  it('exposes legacy id from sqlite_case_id', () => {
    const row = mapCaseRow({
      id: '100',
      sqlite_case_id: '42',
      customer_legacy_id: '7',
      title: 'Case A',
      description: '',
      channel: 'email',
      priority: 'binh_thuong',
      status: 'tiep_nhan',
      assigned_to: '',
      assigned_staff_id: null,
      assigned_at: '',
      pipeline_stage: '',
      campaign_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      customer_name: 'Cust',
      customer_phone: '09',
      customer_email: '',
      customer_address: '',
      customer_company: '',
      staff_display_name: '',
    });
    expect(row.id).toBe(42);
    expect(row.customer_id).toBe(7);
    expect(row.title).toBe('Case A');
  });

  it('maps care report legacy case id', () => {
    const row = mapCareReportRow(
      {
        id: '10',
        sqlite_report_id: '5',
        case_id: '100',
        staff_id: null,
        staff_name: '',
        contact_type: 'goi_dien',
        care_status: 'da_lien_he_thanh_cong',
        summary: 'ok',
        next_action: '',
        created_at: '2026-01-01T00:00:00.000Z',
      },
      42,
    );
    expect(row.id).toBe(5);
    expect(row.case_id).toBe(42);
  });
});
