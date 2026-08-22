/** FE gate — match API PTT_CONTENT_MARKETING_FE on staging/prod. */
export function isContentMarketingFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_CONTENT_MARKETING ?? '0').trim().toLowerCase(),
  );
}
