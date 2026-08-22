import type { LeadMeetingPrepRow } from './lead-meeting-prep.types';

export interface LmpConsultMergeFields {
  external_research_summary: string;
  external_research_sources: number;
  recommended_dv_codes: string[];
  close_brief: string;
  meeting_prep_status: string;
  meeting_prep_stage: string | null;
  close_readiness_score: number | null;
}

const EMPTY: LmpConsultMergeFields = {
  external_research_summary: '',
  external_research_sources: 0,
  recommended_dv_codes: [],
  close_brief: '',
  meeting_prep_status: 'none',
  meeting_prep_stage: null,
  close_readiness_score: null,
};

function asRecord(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, unknown>) : null;
}

export function extractLmpConsultMergeFields(row: LeadMeetingPrepRow | null): LmpConsultMergeFields {
  if (!row) return { ...EMPTY };

  const result = row.result_json;
  const meta = asRecord(result?.meta);
  const company = asRecord(result?.company_profile);
  const sci = asRecord(result?.close_intelligence);
  const services = Array.isArray(result?.recommended_services) ? result.recommended_services : [];

  const dvCodes = services
    .map((s) => asRecord(s)?.dv_code)
    .filter((c): c is string => typeof c === 'string' && Boolean(c.trim()))
    .map((c) => c.trim().toUpperCase());

  const painBasis = asRecord(sci?.pain_roi_estimate)?.basis;
  const talkPhases = asRecord(asRecord(sci?.talk_track)?.phases);
  const opening =
    Array.isArray(talkPhases) && talkPhases.length
      ? String(asRecord(talkPhases[0])?.script_vi ?? '').trim()
      : '';

  return {
    external_research_summary: String(company?.summary ?? '').trim(),
    external_research_sources: Number(meta?.sources_count ?? 0) || 0,
    recommended_dv_codes: dvCodes,
    close_brief: String(painBasis ?? opening ?? company?.summary ?? '').trim().slice(0, 4000),
    meeting_prep_status: row.status,
    meeting_prep_stage: row.prep_stage,
    close_readiness_score: row.close_readiness_score,
  };
}

export function mergeLmpIntoConsultBrief(
  brief: Record<string, unknown>,
  lmp: LmpConsultMergeFields,
): Record<string, unknown> {
  if (!lmp.external_research_summary && !lmp.recommended_dv_codes.length) {
    return brief;
  }
  return {
    ...brief,
    external_research_summary: lmp.external_research_summary,
    external_research_sources: lmp.external_research_sources,
    recommended_dv_codes: lmp.recommended_dv_codes,
    close_brief: lmp.close_brief,
    meeting_prep: {
      status: lmp.meeting_prep_status,
      prep_stage: lmp.meeting_prep_stage,
      close_readiness_score: lmp.close_readiness_score,
    },
  };
}

export function applyLmpDvCodesToConsultPrefill(
  formData: Record<string, unknown>,
  dvCodes: string[],
  formFields: Array<{ key?: string; name?: string }> | unknown[],
  overwrite: boolean,
): { form_data: Record<string, unknown>; filled: string[] } {
  if (!dvCodes.length) return { form_data: formData, filled: [] };

  const labels = dvCodes.join(', ');
  const fieldKeys = new Set(
    (Array.isArray(formFields) ? formFields : [])
      .map((f) => {
        const row = f as { key?: string; name?: string };
        return String(row.key ?? row.name ?? '').trim();
      })
      .filter(Boolean),
  );

  const targets = ['service_interest', 'scope_recommendation'].filter(
    (key) => fieldKeys.size === 0 || fieldKeys.has(key),
  );
  const out = { ...formData };
  const filled: string[] = [];

  for (const key of targets) {
    const existing = String(out[key] ?? '').trim();
    if (existing && !overwrite) continue;
    const next = `SCI gợi ý DV: ${labels}`.slice(0, 4000);
    if (String(out[key] ?? '') !== next) {
      out[key] = next;
      filled.push(key);
    }
  }

  return { form_data: out, filled };
}
