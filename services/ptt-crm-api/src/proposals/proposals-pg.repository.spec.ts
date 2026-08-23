import { mapLineRow, mapProposalRow } from './proposals-pg.mapper';

describe('proposals-pg.mapper', () => {
  it('mapProposalRow exposes legacy id from sqlite_proposal_id', () => {
    const row = mapProposalRow(
      {
        id: '100',
        sqlite_proposal_id: '42',
        legacy_customer_id: '7',
        customer_id: '100',
        lead_id: null,
        presales_id: null,
        lifecycle_id: null,
        service_slugs: '["svc-a"]',
        total_vnd: '5000000',
        timeline_months: '3',
        notes: 'note',
        ai_output: '{}',
        status: 'draft',
        valid_until: null,
        price_adjustment_reason: '',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      true,
    );
    expect(row.id).toBe(42);
    expect(row.customer_id).toBe(7);
    expect(row.service_slugs).toEqual(['svc-a']);
  });

  it('mapProposalRow falls back to id when sqlite_proposal_id missing', () => {
    const row = mapProposalRow(
      {
        id: '99',
        customer_id: '5',
        service_slugs: '[]',
        ai_output: '{}',
        status: 'sent',
        created_at: '',
        updated_at: '',
      },
      false,
    );
    expect(row.id).toBe(99);
  });

  it('mapLineRow exposes legacy id from sqlite_line_id', () => {
    const row = mapLineRow(
      {
        id: '200',
        sqlite_line_id: '15',
        proposal_id: '100',
        dv_code: 'DV01',
        sku_code: 'SKU1',
        package_tier: 'standard',
        service_slug: 'svc-a',
        reference_price_min: '1000',
        reference_price_max: '2000',
        final_price_vnd: '1500',
        scope_notes: '',
        lifecycle_id: null,
        sort_order: '0',
      },
      42,
    );
    expect(row.id).toBe(15);
    expect(row.proposal_id).toBe(42);
  });

  it('mapLineRow falls back to id when sqlite_line_id missing', () => {
    const row = mapLineRow({
      id: '88',
      proposal_id: '10',
      dv_code: 'DV02',
      package_tier: 'basic',
      service_slug: 'svc-b',
      reference_price_min: '0',
      reference_price_max: '0',
      final_price_vnd: '0',
      scope_notes: '',
      sort_order: '1',
    });
    expect(row.id).toBe(88);
    expect(row.proposal_id).toBe(10);
  });
});
