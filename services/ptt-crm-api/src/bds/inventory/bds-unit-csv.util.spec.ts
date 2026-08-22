import { parseUnitCsv } from './bds-unit-csv.util';

// v1: no quoted-comma support — cells are split on raw `,` only.

describe('parseUnitCsv', () => {
  it('reads header and rows', () => {
    const rows = parseUnitCsv('unit_code,tower,floor,pool\nA-01,A,12,inhouse\n');
    expect(rows).toEqual([
      { unit_code: 'A-01', tower: 'A', floor: '12', pool: 'inhouse' },
    ]);
  });

  it('requires unit_code column', () => {
    expect(() => parseUnitCsv('tower,floor\nA,1\n')).toThrow(/unit_code/);
  });
});
