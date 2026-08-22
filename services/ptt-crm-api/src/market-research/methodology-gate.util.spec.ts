import { assertMethodologyExportable } from './methodology-gate.util';
import type { MethodologyBlock } from './market-research.types';

const complete: MethodologyBlock = {
  population: 'Urban shoppers 18-45 HCM',
  source_plan: 'Desk + store checks Q3',
  limitation: 'No panel; desk only 2026',
};

const stub: MethodologyBlock = {
  stub: true,
  population: '',
  source_plan: '',
  limitation: '',
};

describe('assertMethodologyExportable', () => {
  it('throws methodology_incomplete for TC + stub', () => {
    expect(() => assertMethodologyExportable('TC', stub)).toThrow('methodology_incomplete');
    try {
      assertMethodologyExportable('TC', stub);
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('methodology_incomplete');
    }
  });

  it('allows CB + stub (P0 no regress)', () => {
    expect(() => assertMethodologyExportable('CB', stub)).not.toThrow();
  });

  it('allows TC when all three fields are at least 8 chars', () => {
    expect(() => assertMethodologyExportable('TC', complete)).not.toThrow();
  });

  it('throws when a TC field is shorter than 8 after trim', () => {
    expect(() =>
      assertMethodologyExportable('TC', { ...complete, limitation: '  short  ' }),
    ).toThrow('methodology_incomplete');
  });
});
