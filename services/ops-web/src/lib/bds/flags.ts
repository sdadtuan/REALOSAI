export function isBdsUiFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_PTT_BDS_UI ?? '0').trim().toLowerCase(),
  );
}

export function isBdsNavHideB2bFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_PTT_BDS_NAV_HIDE_B2B ?? '0').trim().toLowerCase(),
  );
}
