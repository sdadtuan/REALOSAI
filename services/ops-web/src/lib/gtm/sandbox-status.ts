export function canGrantSandbox(status: string): boolean {
  return status === 'qualified' || status === 'demo_booked';
}
