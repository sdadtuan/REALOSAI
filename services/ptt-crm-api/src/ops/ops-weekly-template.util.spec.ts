import { canSpawnWeeklyTasks, flattenWeeklyTemplate } from './ops-weekly-template.util';

describe('ops-weekly-template.util', () => {
  it('flattens array template', () => {
    const tasks = flattenWeeklyTemplate([
      { id: 'DV02-T1', title: 'Lập kế hoạch content', owner_role: 'TeamLead', day_of_week: 1 },
    ]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('DV02-T1');
  });

  it('flattens phases template', () => {
    const tasks = flattenWeeklyTemplate({
      phases: [
        {
          week_label: 'Tuần 1',
          tasks: [{ id: 'A', title: 'Task A' }, { title: 'Task B' }],
        },
      ],
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[1].id).toBe('T-2');
  });

  it('canSpawnWeeklyTasks enforces BR-OPS-02', () => {
    expect(canSpawnWeeklyTasks({ status: 'active', stage: 'deliver', spawnEnabled: true }).ok).toBe(
      true,
    );
    expect(canSpawnWeeklyTasks({ status: 'draft', stage: 'deliver', spawnEnabled: true })).toEqual({
      ok: false,
      error: 'lifecycle_not_active',
    });
    expect(canSpawnWeeklyTasks({ status: 'active', stage: 'lead', spawnEnabled: true })).toEqual({
      ok: false,
      error: 'lifecycle_stage_not_delivering',
    });
  });
});
