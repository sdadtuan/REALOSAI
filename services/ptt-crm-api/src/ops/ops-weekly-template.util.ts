export type OpsWeeklyTemplateTask = {
  id: string;
  title: string;
  owner_role?: string;
  day_of_week?: number | null;
  kpi_key?: string | null;
  deliverable?: string;
  client_action?: string;
};

export type OpsWeeklyTemplatePhase = {
  week_label?: string;
  tasks: OpsWeeklyTemplateTask[];
};

export type OpsWeeklyTemplate = OpsWeeklyTemplateTask[] | { phases: OpsWeeklyTemplatePhase[] };

function normalizeTask(raw: Record<string, unknown>, index: number): OpsWeeklyTemplateTask | null {
  const id = String(raw.id ?? raw.template_task_id ?? `T-${index + 1}`).trim();
  const title = String(raw.title ?? raw.task ?? '').trim();
  if (!title) return null;
  const dayRaw = raw.day_of_week ?? raw.day;
  const day =
    dayRaw != null && Number.isFinite(Number(dayRaw)) ? Math.min(7, Math.max(1, Number(dayRaw))) : null;
  return {
    id,
    title,
    owner_role: String(raw.owner_role ?? 'TeamLead').trim() || 'TeamLead',
    day_of_week: day,
    kpi_key: raw.kpi_key != null ? String(raw.kpi_key) : null,
    deliverable: raw.deliverable != null ? String(raw.deliverable) : undefined,
    client_action: raw.client_action != null ? String(raw.client_action) : undefined,
  };
}

/** Flatten weekly_process_template JSONB into spawnable checklist tasks. */
export function flattenWeeklyTemplate(template: unknown): OpsWeeklyTemplateTask[] {
  if (!template) return [];
  if (Array.isArray(template)) {
    return template
      .map((item, i) => normalizeTask(item as Record<string, unknown>, i))
      .filter((t): t is OpsWeeklyTemplateTask => t != null);
  }
  if (typeof template === 'object' && template != null && 'phases' in template) {
    const phases = (template as { phases?: OpsWeeklyTemplatePhase[] }).phases ?? [];
    const out: OpsWeeklyTemplateTask[] = [];
    let index = 0;
    for (const phase of phases) {
      for (const task of phase.tasks ?? []) {
        const normalized = normalizeTask(task as unknown as Record<string, unknown>, index);
        index += 1;
        if (normalized) out.push(normalized);
      }
    }
    return out;
  }
  return [];
}

export const OPS_SPAWN_ALLOWED_STATUSES = new Set(['active', 'in_progress']);

export const OPS_SPAWN_ALLOWED_STAGES = new Set(['onboard', 'deliver', 'handover', 'retain']);

export function canSpawnWeeklyTasks(input: {
  status: string;
  stage?: string;
  spawnEnabled: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!input.spawnEnabled) {
    return { ok: false, error: 'weekly_spawn_disabled' };
  }
  const status = String(input.status ?? '').trim().toLowerCase();
  if (!OPS_SPAWN_ALLOWED_STATUSES.has(status)) {
    return { ok: false, error: 'lifecycle_not_active' };
  }
  const stage = String(input.stage ?? '').trim().toLowerCase();
  if (stage && !OPS_SPAWN_ALLOWED_STAGES.has(stage)) {
    return { ok: false, error: 'lifecycle_stage_not_delivering' };
  }
  return { ok: true };
}
