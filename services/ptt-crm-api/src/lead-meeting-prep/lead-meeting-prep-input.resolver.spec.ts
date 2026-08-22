import { LeadMeetingPrepInputResolver } from './lead-meeting-prep-input.resolver';
import type { LeadPrepContextRow } from './lead-meeting-prep.types';

describe('LeadMeetingPrepInputResolver', () => {
  const resolver = new LeadMeetingPrepInputResolver();

  const baseRow = (): LeadPrepContextRow => ({
    lead_id: 1,
    full_name: 'Nguyen Van A',
    phone: '0900123456',
    email: 'a@example.com',
    status: 'moi',
    source: 'web',
    channel: 'manual',
    client_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    is_duplicate: false,
    meta_json: {
      company_name: 'Cty Demo LMP',
      industry: 'BDS',
      notes: 'Can tang lead',
    },
  });

  it('resolves company from meta_json', () => {
    const out = resolver.resolve(baseRow());
    expect(out.input.company_name).toBe('Cty Demo LMP');
    expect(out.skip_reason).toBeUndefined();
  });

  it('skips when company missing', () => {
    const row = baseRow();
    row.meta_json = {};
    const out = resolver.resolve(row);
    expect(out.skip_reason).toBe('missing_company_name');
  });

  it('skips duplicate leads for auto enqueue', () => {
    const row = baseRow();
    row.is_duplicate = true;
    expect(
      resolver.isEligibleForAutoEnqueue(row, {
        pilotClientIds: [],
      }),
    ).toBe('duplicate_lead');
  });
});
