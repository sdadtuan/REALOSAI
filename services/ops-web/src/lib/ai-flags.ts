/** RNOS-06 — client feature gate for AI Copilot (ops-web). */

export type CopilotRolloutMode = 'pilot' | 'team' | 'all';

export function aiCopilotEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_PTT_AI_COPILOT_ENABLED ?? '0').trim().toLowerCase() !== '0';
}

export function aiCopilotRolloutMode(): CopilotRolloutMode {
  const raw = (process.env.NEXT_PUBLIC_PTT_AI_COPILOT_ROLLOUT_MODE ?? 'pilot').trim().toLowerCase();
  if (raw === 'team' || raw === 'all') return raw;
  return 'pilot';
}

export function aiCopilotTeamCaps(): string[] {
  const raw = (process.env.NEXT_PUBLIC_PTT_AI_COPILOT_TEAM_CAPS ?? 'crm_leads').trim();
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function aiCopilotPilotUserIds(): string[] {
  const raw = (process.env.NEXT_PUBLIC_PTT_AI_PILOT_USER_IDS ?? '').trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** When pilot list empty, all staff with cap may use copilot (matches Nest default). */
export function isAiPilotUser(staffId: string | undefined | null): boolean {
  if (!staffId) return false;
  const cohort = aiCopilotPilotUserIds();
  if (cohort.length === 0) return true;
  return cohort.includes(staffId);
}

export function canUseAiCopilot(
  staffId: string | undefined | null,
  caps?: Array<{ section: string; action: string }> | null,
): boolean {
  if (!aiCopilotEnabled()) return false;
  const mode = aiCopilotRolloutMode();
  if (mode === 'all') return Boolean(staffId);
  if (mode === 'team') {
    if (!caps?.length) return false;
    const teamCaps = aiCopilotTeamCaps();
    return teamCaps.some((section) =>
      caps.some(
        (cap) => cap.section === section && (cap.action === 'view' || cap.action === 'edit'),
      ),
    );
  }
  return isAiPilotUser(staffId);
}
