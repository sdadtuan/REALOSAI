import {
  assertPresalesL2DocsComplete,
  buildPresalesL2DocsView,
  listPresalesL2Catalog,
  mergePresalesL2DocsPatch,
  validatePresalesL2DocsComplete,
} from './presales-l2-docs.util';

describe('presales-l2-docs.util', () => {
  it('lists catalog for lead-gen', () => {
    const items = listPresalesL2Catalog('lead-gen');
    expect(items.length).toBe(5);
    expect(items.some((item) => item.key === 'meta_lead_export')).toBe(true);
  });

  it('builds view with missing labels', () => {
    const view = buildPresalesL2DocsView('dich-vu-seo-tong-the', { gsc_read: true });
    expect(view.total).toBe(4);
    expect(view.done).toBe(1);
    expect(view.complete).toBe(false);
    expect(view.missing_labels).toContain('GA4');
  });

  it('merges patch only for catalog keys', () => {
    const merged = mergePresalesL2DocsPatch('lead-gen', {}, { meta_lead_export: true, bogus: true });
    expect(merged).toEqual({ meta_lead_export: true });
  });

  it('asserts complete when all checked', () => {
    const slug = 'dich-vu-aeo';
    const stored = Object.fromEntries(
      listPresalesL2Catalog(slug).map((item) => [item.key, true]),
    );
    expect(() => assertPresalesL2DocsComplete(slug, stored)).not.toThrow();
  });

  it('blocks when incomplete', () => {
    const result = validatePresalesL2DocsComplete('dich-vu-aeo', {});
    expect(result.ok).toBe(false);
    expect(result.message).toContain('L2');
  });
});
