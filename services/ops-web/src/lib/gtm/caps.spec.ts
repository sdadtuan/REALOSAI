import { describe, expect, it } from 'vitest';
import { canPublishGtmCms, canViewGtmCms, canViewGtmDemos, canWriteGtmDemos } from './caps';
import type { StoredStaffUser } from '@/lib/auth';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('canViewGtmDemos', () => {
  it('returns false when user is null', () => {
    expect(canViewGtmDemos(null)).toBe(false);
  });

  it('returns true when gtm_demos.view cap present', () => {
    expect(canViewGtmDemos(user([{ section: 'gtm_demos', action: 'view' }]))).toBe(true);
  });

  it('returns true when crm_leads.view cap present (W0 bootstrap)', () => {
    expect(canViewGtmDemos(user([{ section: 'crm_leads', action: 'view' }]))).toBe(true);
  });

  it('returns false when neither cap present', () => {
    expect(canViewGtmDemos(user([{ section: 'crm_board', action: 'view' }]))).toBe(false);
  });
});

describe('canWriteGtmDemos', () => {
  it('requires gtm_demos.write', () => {
    expect(canWriteGtmDemos(user([{ section: 'gtm_demos', action: 'write' }]))).toBe(true);
    expect(canWriteGtmDemos(user([{ section: 'crm_leads', action: 'edit' }]))).toBe(false);
  });
});

describe('canViewGtmCms', () => {
  it('requires gtm.cms.view', () => {
    expect(canViewGtmCms(user([{ section: 'gtm.cms', action: 'view' }]))).toBe(true);
    expect(canViewGtmCms(user([{ section: 'crm_leads', action: 'view' }]))).toBe(false);
  });
});

describe('canPublishGtmCms', () => {
  it('requires gtm.cms.publish', () => {
    expect(canPublishGtmCms(user([{ section: 'gtm.cms', action: 'publish' }]))).toBe(true);
    expect(canPublishGtmCms(user([{ section: 'gtm.cms', action: 'write' }]))).toBe(false);
  });
});
