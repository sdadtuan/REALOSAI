export function isStaffChatFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_PTT_STAFF_CHAT ?? '0').trim().toLowerCase(),
  );
}
