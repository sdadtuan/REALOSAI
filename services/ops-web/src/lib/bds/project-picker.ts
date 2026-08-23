const KEY = 'bds-project-id';

export function readBdsProjectId(): number {
  if (typeof window !== 'undefined') {
    const q = Number(new URLSearchParams(window.location.search).get('project') ?? '');
    if (Number.isFinite(q) && q > 0) return q;
    const stored = Number(window.sessionStorage.getItem(KEY) ?? '');
    if (Number.isFinite(stored) && stored > 0) return stored;
  }
  const env = Number(process.env.NEXT_PUBLIC_BDS_PROJECT_ID ?? 0);
  return Number.isFinite(env) && env > 0 ? env : 0;
}

export function writeBdsProjectId(id: number): void {
  if (typeof window === 'undefined') return;
  if (id > 0) window.sessionStorage.setItem(KEY, String(id));
}
