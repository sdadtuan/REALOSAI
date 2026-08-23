import { BDS_POSITION_SEEDS } from './bds-org-seed';
import { BDS_CAP_CATALOG } from '../bds-cap-catalog';
import { BDS_POSITION_DEFAULT_CAPS, capsForPosition } from './bds-position-default-caps';

describe('BDS_POSITION_DEFAULT_CAPS', () => {
  it('covers all 18 seeded positions', () => {
    expect(Object.keys(BDS_POSITION_DEFAULT_CAPS).sort()).toEqual(
      [...BDS_POSITION_SEEDS].map((p) => p.code).sort(),
    );
  });

  it('every cap exists in BDS_CAP_CATALOG', () => {
    const allowed = new Set(BDS_CAP_CATALOG.map((c) => `${c.section}:${c.action}`));
    for (const caps of Object.values(BDS_POSITION_DEFAULT_CAPS)) {
      for (const c of caps) {
        expect(allowed.has(`${c.section}:${c.action}`)).toBe(true);
      }
    }
  });

  it('tvv cannot approve hold or edit HĐMB', () => {
    const caps = capsForPosition('tvv_inhouse');
    expect(caps.some((c) => c.section === 'bds_holds' && c.action === 'approve')).toBe(false);
    expect(caps.some((c) => c.section === 'bds_transactions' && c.action === 'edit')).toBe(false);
    expect(caps.some((c) => c.section === 'bds_holds' && c.action === 'create')).toBe(true);
    expect(caps.some((c) => c.section === 'bds_transactions' && c.action === 'create')).toBe(true);
  });

  it('gdkd can approve hold and activate policy', () => {
    const caps = capsForPosition('gdkd');
    expect(caps.some((c) => c.section === 'bds_holds' && c.action === 'approve')).toBe(true);
    expect(caps.some((c) => c.section === 'bds_policies' && c.action === 'approve')).toBe(true);
    expect(caps.some((c) => c.section === 'bds_transactions' && c.action === 'edit')).toBe(false);
  });

  it('truong_pc and truong_collection are not the same A set', () => {
    const pc = new Set(capsForPosition('truong_pc').map((c) => `${c.section}:${c.action}`));
    const cl = new Set(capsForPosition('truong_collection').map((c) => `${c.section}:${c.action}`));
    expect(pc.has('bds_legal:approve')).toBe(true);
    expect(cl.has('bds_collections:create')).toBe(true);
    expect(pc.has('bds_collections:create')).toBe(false);
    expect(cl.has('bds_legal:approve')).toBe(false);
  });

  it('unknown position returns empty', () => {
    expect(capsForPosition('not_a_role')).toEqual([]);
  });
});
