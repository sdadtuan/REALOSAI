import {
  mapPermissionAuditRow,
  severityForPermissionMatrix,
} from './admin-audit.mapper';

describe('admin-audit.mapper', () => {
  it('severityForPermissionMatrix critical on view_pii', () => {
    expect(
      severityForPermissionMatrix({
        added: [{ section_id: 'crm_leads', action: 'view_pii' }],
        removed: [],
      }),
    ).toBe('critical');
  });

  it('mapPermissionAuditRow builds matrix summary', () => {
    const event = mapPermissionAuditRow({
      id: 1,
      actor_email: 'admin@pttads.vn',
      position_id: 3,
      position_code: 'KD-01',
      diff_json: {
        position_code: 'KD-01',
        added: [{ section_id: 'crm_leads', action: 'view' }],
        removed: [],
      },
      created_at: '2026-08-11T04:00:00.000Z',
    });
    expect(event.category).toBe('permission_matrix');
    expect(event.summary).toContain('KD-01');
    expect(event.id).toBe('permission_audit:1');
  });

  it('mapPermissionAuditRow job function category', () => {
    const event = mapPermissionAuditRow({
      id: 2,
      actor_email: 'admin@pttads.vn',
      position_id: 0,
      position_code: '',
      diff_json: {
        function_code: 'sales-am',
        added: [],
        removed: [{ section_id: 'crm_leads', action: 'delete' }],
      },
      created_at: '2026-08-11T04:00:00.000Z',
    });
    expect(event.category).toBe('permission_function');
    expect(event.severity).toBe('critical');
  });
});
