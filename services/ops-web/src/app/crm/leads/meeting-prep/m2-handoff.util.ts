import type { LeadMeetingPrepResponse } from './lead-meeting-prep.types';

export function buildM2HandoffBrief(prep: LeadMeetingPrepResponse): {
  painBasis: string;
  urgencyLines: string[];
  redFlags: string[];
  opening: string;
  fullTalkTrack: string;
  readiness: number | null;
} {
  const sci = prep.result?.close_intelligence;
  const phases = sci?.talk_track?.phases ?? [];
  const opening =
    phases[0]?.script_vi?.trim() ||
    prep.result?.consulting_script?.opening?.trim() ||
    '';
  const fullTalkTrack =
    phases.length > 0
      ? phases.map((p) => `${p.phase_vi}\n${p.script_vi}`).join('\n\n')
      : opening;
  return {
    painBasis: sci?.pain_roi_estimate?.basis?.trim() || prep.result?.company_profile?.summary?.slice(0, 280) || '',
    urgencyLines: (sci?.urgency_signals ?? []).slice(0, 3).map((u) => `${u.signal}: ${u.evidence}`),
    redFlags: (sci?.red_flags ?? []).slice(0, 3).map((f) => f.flag_vi),
    opening,
    fullTalkTrack,
    readiness: prep.close_readiness_score ?? sci?.close_readiness_score ?? null,
  };
}

export function buildSolutionCallBriefText(input: {
  externalResearch?: string;
  closeBrief?: string;
  painBasis?: string;
  bantTotal?: number;
  temperatureLabel?: string;
}): string {
  const parts: string[] = ['=== Brief cuộc gọi Solution / Handoff ==='];
  if (input.temperatureLabel || input.bantTotal != null) {
    parts.push(`BANT ${input.bantTotal ?? '—'}/30 · ${input.temperatureLabel ?? '—'}`);
  }
  if (input.externalResearch?.trim()) {
    parts.push('\nResearch DN:\n' + input.externalResearch.trim());
  }
  if (input.closeBrief?.trim()) {
    parts.push('\nClose brief:\n' + input.closeBrief.trim());
  } else if (input.painBasis?.trim()) {
    parts.push('\nPain / ROI:\n' + input.painBasis.trim());
  }
  return parts.join('\n');
}
