import type { MethodologyBlock } from './market-research.types';

export function assertMethodologyExportable(
  tier: 'CB' | 'TC' | 'CS',
  m: MethodologyBlock,
): void {
  if (tier === 'CB' && m.stub === true) return;
  const fields = [m.population, m.source_plan, m.limitation];
  if (fields.some((f) => String(f ?? '').trim().length < 8)) {
    throw Object.assign(new Error('methodology_incomplete'), { code: 'methodology_incomplete' });
  }
}
