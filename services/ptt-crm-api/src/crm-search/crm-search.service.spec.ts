import { buildSearchSnippet, normalizeSearchEntityType } from './crm-search.types';

describe('crm-search.types', () => {
  it('normalizes entity types', () => {
    expect(normalizeSearchEntityType('LEAD')).toBe('lead');
    expect(normalizeSearchEntityType('bad')).toBeNull();
  });

  it('builds snippet around query', () => {
    const snippet = buildSearchSnippet('Hello world from OpenSearch CRM index', 'OpenSearch');
    expect(snippet.toLowerCase()).toContain('opensearch');
  });
});
