import { resolveIntent, buildNarrative, normalizeQueryText } from './nl-query.engine';
import { listNlQueryCatalog } from './nl-query.catalog';

describe('nl-query.engine', () => {
  it('exposes exactly 50 curated intents including hub CPL, ROAS, and attribution', () => {
    const ids = listNlQueryCatalog().map((entry) => entry.id);
    expect(ids).toHaveLength(50);
    expect(ids).toEqual(
      expect.arrayContaining([
        'cpl_by_client_30d',
        'roas_overview_30d',
        'roas_meta_30d',
        'roas_zalo_30d',
        'attribution_drill_paths',
      ]),
    );
  });

  it('resolves intent by id', () => {
    const intent = resolveIntent({ intent_id: 'leads_new_7d' });
    expect(intent?.id).toBe('leads_new_7d');
  });

  it('resolves intent by Vietnamese label', () => {
    const intent = resolveIntent({ question: 'Lead mới 7 ngày' });
    expect(intent?.id).toBe('leads_new_7d');
  });

  it('resolves CPL alias from acceptance doc', () => {
    const intent = resolveIntent({ question: 'cpl meta t-30 theo client' });
    expect(intent?.id).toBe('cpl_meta_t30_overview');
  });

  it('returns null for out-of-scope question', () => {
    expect(resolveIntent({ question: 'SELECT * FROM users' })).toBeNull();
    expect(resolveIntent({ question: 'doanh thu nam 2019 theo nhan vien' })).toBeNull();
  });

  it('normalizes diacritics for matching', () => {
    expect(normalizeQueryText('Vi phạm SLA')).toBe('vi pham sla');
    const intent = resolveIntent({ question: 'vi pham sla' });
    expect(intent?.id).toBe('sla_breach_summary');
  });

  it('builds narrative for SLA summary', () => {
    const intent = resolveIntent({ intent_id: 'sla_breach_summary' })!;
    const narrative = buildNarrative(intent, {
      columns: [],
      rows: [{ breach: 2, warning: 1, ok: 10 }],
    });
    expect(narrative).toContain('2 breach');
  });
});
