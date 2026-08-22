import {
  assertPortalReportReadable,
  assertPublishableInsights,
  buildPortalWatermark,
} from './portal-publish.util';

describe('buildPortalWatermark', () => {
  it("buildPortalWatermark({ clientId: 'acme', email: 'a@b.c', at: new Date('2026-08-14T12:00:00Z') }) → CONFIDENTIAL · acme · a@b.c · 2026-08-14", () => {
    expect(
      buildPortalWatermark({
        clientId: 'acme',
        email: 'a@b.c',
        at: new Date('2026-08-14T12:00:00Z'),
      }),
    ).toBe('CONFIDENTIAL · acme · a@b.c · 2026-08-14');
  });
});

describe('assertPortalReportReadable', () => {
  it('portalVisible: false → code not_found', () => {
    try {
      assertPortalReportReadable({
        portalVisible: false,
        embargoUntil: null,
        expiresAt: null,
        now: new Date('2026-08-14T12:00:00Z'),
      });
      throw new Error('expected not_found');
    } catch (err) {
      expect((err as Error).message).toBe('not_found');
      expect((err as Error & { code: string }).code).toBe('not_found');
    }
  });

  it('embargoUntil in the future → code embargo_active', () => {
    try {
      assertPortalReportReadable({
        portalVisible: true,
        embargoUntil: '2026-08-15T00:00:00Z',
        expiresAt: null,
        now: new Date('2026-08-14T12:00:00Z'),
      });
      throw new Error('expected embargo_active');
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('embargo_active');
    }
  });

  it('expiresAt in the past → code report_expired', () => {
    try {
      assertPortalReportReadable({
        portalVisible: true,
        embargoUntil: null,
        expiresAt: '2026-08-13T00:00:00Z',
        now: new Date('2026-08-14T12:00:00Z'),
      });
      throw new Error('expected report_expired');
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('report_expired');
    }
  });
});

describe('assertPublishableInsights', () => {
  it("assertPublishableInsights(['approved_internal']) → insights_not_client_facing", () => {
    try {
      assertPublishableInsights(['approved_internal']);
      throw new Error('expected insights_not_client_facing');
    } catch (err) {
      expect((err as Error).message).toBe('insights_not_client_facing');
      expect((err as Error & { code: string }).code).toBe('insights_not_client_facing');
    }
  });

  it('allows approved_client_facing and published', () => {
    expect(() =>
      assertPublishableInsights(['approved_client_facing', 'published']),
    ).not.toThrow();
  });
});
