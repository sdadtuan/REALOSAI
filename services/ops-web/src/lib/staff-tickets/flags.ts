export function isStaffTicketsFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS ?? '0').trim().toLowerCase(),
  );
}
