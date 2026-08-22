/** Mirrors crm_svc_workflow_steps.AI_PROMPT_TEMPLATES (presales consult subset). */
export const PRESALES_AI_PROMPT_TEMPLATES: Record<string, string> = {
  consult_analysis: (
    'Bạn là chuyên gia {service_name} của agency PTT.\n' +
    'KH: {customer_name}, ngành: {niche}. Tình trạng hiện tại: {current_status}.\n\n' +
    'BANT Intake: {bant_total}/30 · Quyết định: {decision}\n' +
    'Red flags: {red_flags}\n' +
    'Lead qualify (JSON): {lead_form_json}\n' +
    'Tóm tắt Intake:\n{intake_summary}\n\n' +
    'Brief readiness:\n{consult_brief_json}\n\n' +
    'Viết phân tích 250 từ: tình trạng hiện tại, cơ hội tăng trưởng, ' +
    'thách thức, hướng tiếp cận đề xuất — bám sát dữ liệu Intake/BANT ở trên.'
  ),
};

function safePromptValue(value: unknown, limit = 3500): string {
  return String(value ?? '')
    .replace(/\{/g, '{{')
    .replace(/\}/g, '}}')
    .slice(0, limit);
}

export function buildPresalesAiPromptContext(input: {
  brief: Record<string, unknown>;
  customerName: string;
  serviceLabel: string;
  formContext?: Record<string, unknown>;
}): Record<string, string> {
  const merged: Record<string, unknown> = { ...(input.formContext ?? {}) };
  const leadTask = (input.brief.lead_task ?? {}) as { form_data?: Record<string, unknown> };
  const leadForm = leadTask.form_data ?? {};
  const highlights = (input.brief.highlights ?? {}) as Record<string, unknown>;
  const readiness = (input.brief.readiness ?? {}) as Record<string, unknown>;

  for (const key of ['niche', 'budget', 'need', 'goal', 'current_status']) {
    if (!String(merged[key] ?? '').trim() && leadForm[key] != null && leadForm[key] !== '') {
      merged[key] = leadForm[key];
    }
  }
  if (!String(merged.niche ?? '').trim() && highlights.niche) merged.niche = highlights.niche;
  if (!String(merged.budget ?? '').trim() && highlights.budget_vnd) merged.budget = highlights.budget_vnd;
  if (!String(merged.need ?? '').trim() && highlights.pain) merged.need = highlights.pain;
  if (!String(merged.current_status ?? '').trim()) {
    const parts: string[] = [];
    if (highlights.pain) parts.push(String(highlights.pain));
    if (highlights.domain) parts.push(`Domain: ${highlights.domain}`);
    if (parts.length) merged.current_status = parts.join(' · ');
  }

  const redFlags = input.brief.red_flags;
  return {
    service_name: safePromptValue(input.serviceLabel, 200),
    customer_name: safePromptValue(input.customerName, 200),
    niche: safePromptValue(merged.niche, 500),
    current_status: safePromptValue(merged.current_status, 2000),
    budget: safePromptValue(merged.budget, 200),
    bant_total: String(readiness.bant_total ?? 0),
    decision: safePromptValue(readiness.decision_label ?? readiness.decision ?? '—', 100),
    red_flags: safePromptValue(Array.isArray(redFlags) ? redFlags.join('; ') : '', 1500),
    intake_summary: safePromptValue(input.brief.latest_intake_summary ?? '', 2500),
    lead_form_json: safePromptValue(JSON.stringify(leadForm), 2500),
    consult_brief_json: safePromptValue(
      JSON.stringify({
        readiness,
        highlights,
        recommended_actions: input.brief.recommended_actions ?? [],
      }),
      2500,
    ),
  };
}

export function formatPresalesAiPrompt(templateKey: string, ctx: Record<string, string>): string {
  const template = PRESALES_AI_PROMPT_TEMPLATES[templateKey] ?? '';
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key: string) => ctx[key] ?? '');
}
