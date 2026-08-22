import type { LeadMeetingPrepResponse } from './lead-meeting-prep.types';

export function buildM1Script(prep: LeadMeetingPrepResponse): {
  opening: string;
  questions: string[];
  fullTalkTrack: string;
} {
  const sci = prep.result?.close_intelligence;
  const legacy = prep.result?.consulting_script;
  const phases = sci?.talk_track?.phases ?? [];
  const opening =
    phases[0]?.script_vi?.trim() ||
    legacy?.opening?.trim() ||
    prep.result?.company_profile?.summary?.slice(0, 280) ||
    '';
  const questions =
    legacy?.key_questions?.slice(0, 3) ??
    phases.slice(1, 4).map((p) => p.phase_vi).filter(Boolean);
  const fullTalkTrack =
    phases.length > 0
      ? phases.map((p) => `${p.phase_vi}\n${p.script_vi}`).join('\n\n')
      : [opening, ...(legacy?.key_questions ?? []).map((q, i) => `${i + 1}. ${q}`)]
          .filter(Boolean)
          .join('\n\n');
  return { opening, questions, fullTalkTrack };
}
