import { mapCustomField, mapLeadLookup, mapPipelineStage } from './crm-config-pg.mapper';

describe('crm-config-pg.mapper', () => {
  describe('mapCustomField', () => {
    it('uses sqlite_field_id as legacy id when present', () => {
      const field = mapCustomField({
        id: 9001,
        sqlite_field_id: 42,
        entity_type: 'lead',
        field_key: 'budget',
        label: 'Ngân sách',
        field_type: 'number',
        options_json: ['a', 'b'],
        required: true,
        sort_order: 3,
        active: true,
        created_at: new Date('2026-01-15T10:00:00Z'),
        updated_at: '2026-01-16 12:00:00',
      });
      expect(field.id).toBe(42);
      expect(field.options).toEqual(['a', 'b']);
      expect(field.required).toBe(true);
      expect(field.created_at).toMatch(/^2026-01-15/);
    });

    it('falls back to pg id when sqlite_field_id is missing', () => {
      const field = mapCustomField({
        id: 7,
        entity_type: 'customer',
        field_key: 'note',
        label: 'Ghi chú',
        field_type: 'text',
        options_json: '[]',
        required: false,
        sort_order: 0,
        active: 1,
        created_at: '',
        updated_at: '',
      });
      expect(field.id).toBe(7);
      expect(field.options).toEqual([]);
      expect(field.active).toBe(true);
    });
  });

  describe('mapPipelineStage', () => {
    it('uses sqlite_stage_id as legacy id when present', () => {
      const stage = mapPipelineStage({
        id: 500,
        sqlite_stage_id: 12,
        pipeline_key: 'sales',
        stage_key: 'sql',
        label: 'SQL',
        sort_order: 2,
        sla_hours: 48,
        owner_role: 'Sales',
        is_terminal: false,
        active: true,
        updated_at: new Date('2026-02-01T08:30:00Z'),
      });
      expect(stage.id).toBe(12);
      expect(stage.stage_key).toBe('sql');
      expect(stage.sla_hours).toBe(48);
      expect(stage.updated_at).toMatch(/^2026-02-01/);
    });

    it('defaults pipeline_key and parses booleans', () => {
      const stage = mapPipelineStage({
        id: 3,
        stage_key: 'won',
        label: 'Thắng',
        sort_order: 9,
        sla_hours: 0,
        owner_role: '',
        is_terminal: 1,
        active: 0,
        updated_at: '',
      });
      expect(stage.id).toBe(3);
      expect(stage.pipeline_key).toBe('sales');
      expect(stage.is_terminal).toBe(true);
      expect(stage.active).toBe(false);
    });
  });

  describe('mapLeadLookup', () => {
    it('uses sqlite_lookup_id as legacy id when present', () => {
      const lookup = mapLeadLookup({
        id: 800,
        sqlite_lookup_id: 5,
        kind: 'source',
        option_key: 'web',
        label: 'Website',
        sort_order: 1,
        active: true,
        created_at: '2026-03-01 09:00:00',
        updated_at: '2026-03-01 09:00:00',
      });
      expect(lookup.id).toBe(5);
      expect(lookup.kind).toBe('source');
      expect(lookup.option_key).toBe('web');
    });

    it('falls back to pg id when sqlite_lookup_id is missing', () => {
      const lookup = mapLeadLookup({
        id: 99,
        kind: 'channel',
        option_key: 'zalo',
        label: 'Zalo',
        sort_order: 2,
        active: false,
        created_at: '',
        updated_at: '',
      });
      expect(lookup.id).toBe(99);
      expect(lookup.active).toBe(false);
    });
  });
});
