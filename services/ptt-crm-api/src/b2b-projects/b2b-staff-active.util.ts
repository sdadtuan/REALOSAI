export function resolveIsActivePttStaff(row: { active: boolean | null }): boolean {
  return row.active === true;
}
