import {
  buildSciRedFlagBlockInfo,
  extractBlockingRedFlagsFromSci,
} from './lmp-red-flag-block.util';

describe('lmp-red-flag-block.util', () => {
  it('extractBlockingRedFlagsFromSci keeps block severity only', () => {
    const flags = extractBlockingRedFlagsFromSci({
      red_flags: [
        { flag_vi: 'Không có budget', severity: 'block', mitigation_vi: 'Hỏi lại BANT' },
        { flag_vi: 'Cần suy nghĩ', severity: 'warn', mitigation_vi: 'ROI script' },
      ],
    });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.flag_vi).toBe('Không có budget');
  });

  it('buildSciRedFlagBlockInfo inactive when no block flags', () => {
    const info = buildSciRedFlagBlockInfo({
      red_flags: [{ flag_vi: 'Warn only', severity: 'warn', mitigation_vi: 'x' }],
    });
    expect(info.active).toBe(false);
    expect(info.reason).toBe('');
  });

  it('buildSciRedFlagBlockInfo active with reason', () => {
    const info = buildSciRedFlagBlockInfo({
      red_flags: [{ flag_vi: 'Đối thủ khóa', severity: 'block', mitigation_vi: 'GDKD' }],
    });
    expect(info.active).toBe(true);
    expect(info.reason).toContain('Đối thủ khóa');
    expect(info.reason).toContain('GDKD override');
  });
});
