import { hashApiKey, resolveIngressProject } from './b2b-ingest.util';

describe('resolveIngressProject', () => {
  const forms = [{ formId: 'F1', pageId: 'PG1', projectId: 'p1', projectSlug: 'seo', active: true }];
  const pages = [{ pageId: 'PG1', projectId: 'p1', projectSlug: 'seo', active: true }];

  it('maps form to project', () => {
    expect(resolveIngressProject({ channel: 'facebook', formId: 'F1', projectSlug: 'seo' }, { forms, pages })).toEqual({
      projectId: 'p1',
    });
  });

  it('B2B-07 unmapped form', () => {
    expect(resolveIngressProject({ channel: 'facebook', formId: 'FX', projectSlug: 'seo' }, { forms, pages })).toEqual({
      unmatched: true,
      reason: 'form_unmapped',
    });
  });

  it('slug mismatch → unmatched', () => {
    expect(resolveIngressProject({ channel: 'facebook', formId: 'F1', projectSlug: 'other' }, { forms, pages })).toEqual({
      unmatched: true,
      reason: 'slug_mismatch',
    });
  });

  it('maps zalo oa', () => {
    expect(
      resolveIngressProject(
        { channel: 'zalo', oaId: 'OA1', projectSlug: 'seo' },
        {
          forms,
          pages,
          accounts: [{ channel: 'zalo', externalKey: 'OA1', projectId: 'p1', projectSlug: 'seo', active: true }],
        },
      ),
    ).toEqual({ projectId: 'p1' });
  });
});

describe('hashApiKey', () => {
  it('returns sha256 hex', () => {
    expect(hashApiKey('secret')).toMatch(/^[a-f0-9]{64}$/);
  });
});
