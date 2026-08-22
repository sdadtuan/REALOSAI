/** FE gate — must match API PTT_MKT_AI_PORTAL_SUMMARY on staging/prod. */
export function isMktAiPortalSummaryFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_MKT_AI_PORTAL_SUMMARY ?? '0').trim().toLowerCase(),
  );
}
