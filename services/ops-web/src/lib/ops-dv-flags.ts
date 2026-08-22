/** FE gate — match API PTT_OPS_DV / NEXT_PUBLIC_OPS_DV on staging/prod. */
export function isOpsDvFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_OPS_DV ?? '0').trim().toLowerCase(),
  );
}
