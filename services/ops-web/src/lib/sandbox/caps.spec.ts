import { describe, expect, it } from 'vitest';
import { seedSandboxLeads } from './leads-seed';
import { isSandboxAllowedPath, isSandboxVisitor } from './caps';

describe('sandbox caps', () => {
  it('detects sandbox visitor', () => {
    expect(isSandboxVisitor({ position_code: 'sandbox_visitor' } as never)).toBe(true);
    expect(isSandboxVisitor({ position_code: 'sales' } as never)).toBe(false);
  });

  it('whitelists sandbox routes', () => {
    expect(isSandboxAllowedPath('/sandbox/leads')).toBe(true);
    expect(isSandboxAllowedPath('/login')).toBe(true);
    expect(isSandboxAllowedPath('/crm/gtm/demos')).toBe(false);
  });

  it('seeds five tenant-scoped demo leads', () => {
    const rows = seedSandboxLeads('sandbox_agency');
    expect(rows).toHaveLength(5);
    expect(rows[0]?.company).toContain('agency');
  });
});
