import {
  offboardLeadPositionCode,
  shouldReleaseHoldOnOffboard,
} from './bds-offboard.util';

describe('shouldReleaseHoldOnOffboard', () => {
  it('U-08 pending / active without deposit', () => {
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'pending', txStage: null })).toBe(true);
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'active', txStage: 'reservation' })).toBe(
      true,
    );
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'active', txStage: 'cancelled' })).toBe(
      true,
    );
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'active', txStage: 'lost' })).toBe(true);
  });

  it('U-07 keeps hold after deposit or later', () => {
    for (const txStage of ['deposit', 'vbtt', 'contracted', 'handed_over', 'title_issued']) {
      expect(shouldReleaseHoldOnOffboard({ holdStatus: 'active', txStage })).toBe(false);
    }
  });

  it('ignores already-closed holds', () => {
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'cancelled', txStage: null })).toBe(false);
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'converted', txStage: 'deposit' })).toBe(
      false,
    );
    expect(shouldReleaseHoldOnOffboard({ holdStatus: 'expired', txStage: null })).toBe(false);
  });
});

describe('offboardLeadPositionCode', () => {
  it('maps BĐS dept to trưởng — not generic truong', () => {
    expect(offboardLeadPositionCode('ban_kd')).toBe('truong_inhouse');
    expect(offboardLeadPositionCode('ban_kenh')).toBe('truong_kenh');
    expect(offboardLeadPositionCode('ban_phap_che')).toBe('truong_pc');
    expect(offboardLeadPositionCode('ban_tc_collection')).toBe('truong_collection');
    expect(offboardLeadPositionCode('unknown_dept')).toBe('truong');
  });
});
