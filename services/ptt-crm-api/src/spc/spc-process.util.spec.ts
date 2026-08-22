import {
  pickSpawnPhaseIndex,
  resolveProcessPhasesForSku,
  tasksFromProcessPhase,
  type SpcProcessPhase,
} from './spc-process.util';

const base = (code: string, order: number): SpcProcessPhase => ({
  phase_code: code,
  dv_code: 'DV02',
  sku_code: null,
  week_label_vi: `Week ${order}`,
  ptt_work_vi: `Work ${order}`,
  deliverable_vi: '',
  client_action_vi: '',
  tasks_json: [{ id: `${code}-1`, title: `Task ${order}` }],
  sort_order: order,
});

describe('spc-process.util', () => {
  it('returns base phases when no SKU overrides', () => {
    const phases = resolveProcessPhasesForSku([base('DV02-T1', 1), base('DV02-T2', 2)], 'DV02-TC');
    expect(phases.map((p) => p.phase_code)).toEqual(['DV02-T1', 'DV02-T2']);
  });

  it('replaces base phase at same sort_order with SKU override', () => {
    const override: SpcProcessPhase = {
      ...base('DV02-T1-CS', 1),
      sku_code: 'DV02-CS',
      ptt_work_vi: 'CS extra onboarding',
    };
    const phases = resolveProcessPhasesForSku(
      [base('DV02-T1', 1), base('DV02-T2', 2), override],
      'DV02-CS',
    );
    expect(phases[0].phase_code).toBe('DV02-T1-CS');
    expect(phases[1].phase_code).toBe('DV02-T2');
  });

  it('tasksFromProcessPhase prefixes task ids with phase_code', () => {
    const tasks = tasksFromProcessPhase(base('DV02-T1', 1));
    expect(tasks[0].id).toBe('DV02-T1-1');
    expect(tasks[0].title).toBe('Task 1');
  });

  it('pickSpawnPhaseIndex caps at last phase', () => {
    expect(pickSpawnPhaseIndex(0, 3)).toBe(0);
    expect(pickSpawnPhaseIndex(2, 3)).toBe(2);
    expect(pickSpawnPhaseIndex(99, 3)).toBe(2);
  });
});
