import {
  flattenWeeklyTemplate,
  type OpsWeeklyTemplateTask,
} from '../ops/ops-weekly-template.util';

export type SpcProcessPhase = {
  phase_code: string;
  dv_code: string;
  sku_code: string | null;
  week_label_vi: string;
  ptt_work_vi: string;
  deliverable_vi: string;
  client_action_vi: string;
  tasks_json: unknown;
  sort_order: number;
  active?: boolean;
};

/** Merge DV-default phases (sku_code null) with SKU-specific overrides by sort_order. */
export function resolveProcessPhasesForSku(
  allPhases: SpcProcessPhase[],
  skuCode?: string | null,
): SpcProcessPhase[] {
  const sku = String(skuCode ?? '').trim().toUpperCase() || null;
  const forDv = allPhases
    .filter((p) => p.active !== false)
    .sort((a, b) => a.sort_order - b.sort_order || a.phase_code.localeCompare(b.phase_code));

  const base = forDv.filter((p) => !p.sku_code);
  const overrides = sku ? forDv.filter((p) => p.sku_code === sku) : [];

  if (!overrides.length) return base;

  const merged: SpcProcessPhase[] = [];
  const usedOverrideCodes = new Set<string>();

  for (const basePhase of base) {
    const override = overrides.find((o) => o.sort_order === basePhase.sort_order);
    if (override) {
      merged.push(override);
      usedOverrideCodes.add(override.phase_code);
    } else {
      merged.push(basePhase);
    }
  }
  for (const override of overrides) {
    if (!usedOverrideCodes.has(override.phase_code)) {
      merged.push(override);
    }
  }
  return merged.sort(
    (a, b) => a.sort_order - b.sort_order || a.phase_code.localeCompare(b.phase_code),
  );
}

/** Flatten SPC phase tasks_json into spawn-week checklist tasks. */
export function tasksFromProcessPhase(phase: SpcProcessPhase): OpsWeeklyTemplateTask[] {
  let tasks = flattenWeeklyTemplate(phase.tasks_json);
  if (tasks.length === 0 && phase.ptt_work_vi.trim()) {
    tasks = flattenWeeklyTemplate([
      { id: `${phase.phase_code}-1`, title: phase.ptt_work_vi, owner_role: 'TeamLead' },
    ]);
  }
  return tasks.map((task, index) => {
    const id = String(task.id ?? '').trim();
    const prefixed =
      id && id.startsWith(phase.phase_code) ? id : `${phase.phase_code}-${id || index + 1}`;
    return { ...task, id: prefixed };
  });
}

export function pickSpawnPhaseIndex(spawnCount: number, phaseCount: number): number {
  if (phaseCount <= 0) return 0;
  return Math.min(Math.max(0, spawnCount), phaseCount - 1);
}
