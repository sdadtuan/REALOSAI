/** FE fail-closed gate — must match API PTT_MKT_AI_PLANNER_ENABLED on staging/prod. */
export function isMktAiPlannerFeEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.NEXT_PUBLIC_MKT_AI_PLANNER ?? '0').trim().toLowerCase(),
  );
}
