import type { LeadMeetingPrepRow } from './lead-meeting-prep.types';

export function buildM1ScriptFromPrepRow(row: LeadMeetingPrepRow | null): {
  opening: string;
  script_full: string;
} {
  if (!row || row.status !== 'ready') {
    return { opening: '', script_full: '' };
  }
  const result = row.result_json ?? {};
  const sci = (result.close_intelligence ?? {}) as Record<string, unknown>;
  const legacy = (result.consulting_script ?? {}) as Record<string, unknown>;
  const talkTrack = (sci.talk_track ?? {}) as { phases?: Array<{ phase_vi?: string; script_vi?: string }> };
  const phases = talkTrack.phases ?? [];
  const opening =
    phases[0]?.script_vi?.trim() ||
    String(legacy.opening ?? '').trim() ||
    String((result.company_profile as { summary?: string } | undefined)?.summary ?? '').slice(0, 280) ||
    '';
  const legacyQuestions = Array.isArray(legacy.key_questions)
    ? (legacy.key_questions as string[])
    : [];
  const scriptFull =
    phases.length > 0
      ? phases.map((p) => `${p.phase_vi}\n${p.script_vi}`).join('\n\n')
      : [opening, ...legacyQuestions.map((q, i) => `${i + 1}. ${q}`)].filter(Boolean).join('\n\n');
  return { opening, script_full: scriptFull };
}
