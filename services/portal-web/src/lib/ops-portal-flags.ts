/** FE gate — match API PTT_OPS_PORTAL_SUMMARY on staging/prod. */
export function isOpsPortalSummaryFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_OPS_PORTAL_SUMMARY ?? '0').trim().toLowerCase(),
  );
}
