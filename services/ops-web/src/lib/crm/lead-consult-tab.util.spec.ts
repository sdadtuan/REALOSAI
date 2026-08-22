import { describe, expect, it } from 'vitest';
import type { LeadFunnelSnapshot } from '@/lib/api';
import { showLeadConsultTab } from './lead-consult-tab.util';

describe('showLeadConsultTab', () => {
  it('shows for consult and proposal only', () => {
    const base = {
      presales: { id: 1, stage: 'consult', service_slug: 'lead-gen', status: 'active' },
    } as LeadFunnelSnapshot['presales'];

    expect(showLeadConsultTab({ presales: base } as LeadFunnelSnapshot)).toBe(true);
    expect(
      showLeadConsultTab({
        presales: { ...base, presales: { ...base!.presales, stage: 'proposal' } },
      } as LeadFunnelSnapshot),
    ).toBe(true);
    expect(
      showLeadConsultTab({
        presales: { ...base, presales: { ...base!.presales, stage: 'lead' } },
      } as LeadFunnelSnapshot),
    ).toBe(false);
    expect(showLeadConsultTab(null)).toBe(false);
  });
});
