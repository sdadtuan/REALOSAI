export function isBdsUiFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_PTT_BDS_UI ?? '0').trim().toLowerCase(),
  );
}
