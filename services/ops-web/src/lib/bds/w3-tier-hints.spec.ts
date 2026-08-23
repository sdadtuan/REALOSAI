import { describe, expect, it } from 'vitest';
import { uniqueTierIdsFromAgencies } from './w3-tier-hints';

describe('uniqueTierIdsFromAgencies', () => {
  it('dedupes non-null tier_id', () => {
    expect(
      uniqueTierIdsFromAgencies([
        { id: 'a1', code: 'A1', name: 'A1', status: 'active', tier_id: 't1' },
        { id: 'a2', code: 'A2', name: 'A2', status: 'active', tier_id: 't1' },
        { id: 'a3', code: 'A3', name: 'A3', status: 'active', tier_id: 't2' },
      ]),
    ).toEqual(['t1', 't2']);
  });
});
