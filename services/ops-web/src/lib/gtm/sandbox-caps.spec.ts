import { describe, expect, it } from 'vitest';
import {
  canExportGtmDemos,
  canGrantSandbox,
  canGrantSandboxRow,
  canImportGtmDemos,
} from './sandbox-caps';
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

describe('canGrantSandbox', () => {
  it('requires gtm.sandbox.grant cap', () => {
    expect(canGrantSandbox(user([{ section: 'gtm.sandbox', action: 'grant' }]))).toBe(true);
    expect(canGrantSandbox(user([{ section: 'gtm_demos', action: 'write' }]))).toBe(false);
    expect(canGrantSandbox(null)).toBe(false);
  });
});

describe('canGrantSandboxRow', () => {
  it('combines cap and status', () => {
    const grantUser = user([{ section: 'gtm.sandbox', action: 'grant' }]);
    expect(canGrantSandboxRow(grantUser, 'demo_booked')).toBe(true);
    expect(canGrantSandboxRow(grantUser, 'new')).toBe(false);
  });
});

describe('canExportGtmDemos', () => {
  it('allows gtm.demos.export or gtm_demos.view fallback', () => {
    expect(canExportGtmDemos(user([{ section: 'gtm.demos', action: 'export' }]))).toBe(true);
    expect(canExportGtmDemos(user([{ section: 'gtm_demos', action: 'view' }]))).toBe(true);
  });
});

describe('canImportGtmDemos', () => {
  it('requires gtm_demos.write', () => {
    expect(canImportGtmDemos(user([{ section: 'gtm_demos', action: 'write' }]))).toBe(true);
    expect(canImportGtmDemos(user([{ section: 'gtm_demos', action: 'view' }]))).toBe(false);
  });
});
