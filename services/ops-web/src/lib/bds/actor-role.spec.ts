import { describe, expect, it } from 'vitest';
import { agencyActivateRole, policyActivateRole, tierOverrideRole } from './actor-role';

describe('actor-role', () => {
  it('maps W0 positions to Nest role strings', () => {
    expect(policyActivateRole()).toBe('cdt_sales_dir');
    expect(agencyActivateRole()).toBe('cdt_channel');
    expect(tierOverrideRole()).toBe('cdt_sales_dir');
  });
});
