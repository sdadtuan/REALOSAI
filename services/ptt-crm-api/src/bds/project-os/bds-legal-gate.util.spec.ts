import { BadRequestException } from '@nestjs/common';
import {
  REQUIRED_SALE_DOC_TYPES,
  assertOpenPhaseAllowed,
  computeLegalGate,
} from './bds-legal-gate.util';

describe('computeLegalGate', () => {
  const valid = REQUIRED_SALE_DOC_TYPES.map((doc_type) => ({
    doc_type, status: 'valid', expires_on: null as string | null,
  }));

  it('blocked when a required type is missing', () => {
    expect(computeLegalGate(valid.slice(1), new Date(), null)).toBe('blocked');
  });

  it('enough_to_sell when all required valid', () => {
    expect(computeLegalGate(valid, new Date(), null)).toBe('enough_to_sell');
  });

  it('restricted when required doc expired', () => {
    const docs = valid.map((d) =>
      d.doc_type === 'gpxd' ? { ...d, status: 'expired', expires_on: '2020-01-01' } : d,
    );
    expect(computeLegalGate(docs, new Date('2026-01-01'), null)).toBe('restricted');
  });

  it('override until future → enough_to_sell', () => {
    expect(computeLegalGate([], new Date('2026-01-01'), new Date('2026-01-10'))).toBe('enough_to_sell');
  });

  it('restricted when required doc expires_on is before now', () => {
    const docs = valid.map((d) =>
      d.doc_type === 'gpxd' ? { ...d, status: 'valid', expires_on: '2025-12-31' } : d,
    );
    expect(computeLegalGate(docs, new Date('2026-01-01'), null)).toBe('restricted');
  });

  it('restricted when valid gpxd has a sibling expired gpxd', () => {
    const docs = [
      ...valid,
      { doc_type: 'gpxd', status: 'expired', expires_on: '2020-01-01' },
    ];
    expect(computeLegalGate(docs, new Date('2026-01-01'), null)).toBe('restricted');
  });
});

describe('assertOpenPhaseAllowed', () => {
  it('BDS-21 throws legal_gate when blocked', () => {
    try {
      assertOpenPhaseAllowed('blocked');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'legal_gate' });
    }
  });
  it('throws legal_gate when restricted', () => {
    try {
      assertOpenPhaseAllowed('restricted');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'legal_gate' });
    }
  });
  it('allows enough_to_sell', () => {
    expect(() => assertOpenPhaseAllowed('enough_to_sell')).not.toThrow();
  });
});
