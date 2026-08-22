/** S-LMP-2 — Lead Meeting Prep client flag */

export function leadMeetingPrepEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_LEAD_MEETING_PREP ?? '0').trim().toLowerCase() !== '0';
}
