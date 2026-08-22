/** FE gate — must match API PTT_CMKT_PORTAL_SUMMARY on staging/prod. */
export function isCmktPortalSummaryFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_CMKT_PORTAL_SUMMARY ?? '0').trim().toLowerCase(),
  );
}
