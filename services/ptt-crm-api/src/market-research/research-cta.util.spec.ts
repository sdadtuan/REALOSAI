import { researchCtaHref } from './research-cta.util';

describe('researchCtaHref', () => {
  it('returns null for a slug other than phan-tich-thi-truong', () => {
    expect(
      researchCtaHref({
        slug: 'dich-vu-seo-tong-the',
        lifecycleId: 12,
        clientId: 'acme',
      }),
    ).toBeNull();
  });

  it('returns workspace href when a project already has this lifecycle_id', () => {
    const href = researchCtaHref({
      slug: 'phan-tich-thi-truong',
      lifecycleId: 12,
      clientId: 'acme',
      existingProjectId: 44,
    });
    expect(href).toBe('/crm/research/44');
    expect(href).not.toContain('/crm/research/new');
  });

  it('returns wizard href with lifecycle_id and client_id when no existing project', () => {
    expect(
      researchCtaHref({
        slug: 'phan-tich-thi-truong',
        lifecycleId: 12,
        clientId: 'acme',
      }),
    ).toBe('/crm/research/new?lifecycle_id=12&client_id=acme');
  });

  it('omits client_id when it is missing — does not invent a client', () => {
    expect(
      researchCtaHref({
        slug: 'phan-tich-thi-truong',
        lifecycleId: 12,
        clientId: null,
      }),
    ).toBe('/crm/research/new?lifecycle_id=12');
  });
});
