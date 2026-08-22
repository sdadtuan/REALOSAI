export function researchCtaHref(input: {
  slug: string;
  lifecycleId: number;
  clientId?: string | null;
  existingProjectId?: number | null;
}): string | null {
  if (input.slug !== 'phan-tich-thi-truong') return null;
  if (input.existingProjectId) return `/crm/research/${input.existingProjectId}`;
  const q = new URLSearchParams({ lifecycle_id: String(input.lifecycleId) });
  if (input.clientId) q.set('client_id', input.clientId);
  return `/crm/research/new?${q.toString()}`;
}

export type ResearchProjectLookup = 'pending' | number | 'none' | 'error';

export function researchCtaReady(lookup: ResearchProjectLookup): boolean {
  return lookup === 'none' || typeof lookup === 'number';
}
