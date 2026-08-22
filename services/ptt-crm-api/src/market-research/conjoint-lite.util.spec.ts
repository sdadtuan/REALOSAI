import { CJ_LIMITATION } from './market-research.types';
import { choicesFromCjEvidence, computeConjointLite } from './conjoint-lite.util';
import type { CjChoice } from './market-research.types';

const FIXTURE: CjChoice[] = [
  { respondent_id: 'R001', task_id: '1', attributes: { price: '99k', pack_size: '500ml' } },
  { respondent_id: 'R001', task_id: '2', attributes: { price: '89k', pack_size: '500ml' } },
  { respondent_id: 'R002', task_id: '1', attributes: { price: '99k', pack_size: '1L' } },
  { respondent_id: 'R002', task_id: '2', attributes: { price: '89k', pack_size: '1L' } },
  { respondent_id: 'R003', task_id: '1', attributes: { price: '99k', pack_size: '500ml' } },
  { respondent_id: 'R003', task_id: '2', attributes: { price: '99k', pack_size: '1L' } },
  { respondent_id: 'R004', task_id: '1', attributes: { price: '89k', pack_size: '500ml' } },
  { respondent_id: 'R004', task_id: '2', attributes: { price: '89k', pack_size: '500ml' } },
];

describe('computeConjointLite', () => {
  it('M1-1: returns level shares and recommendation', () => {
    const out = computeConjointLite(FIXTURE);
    expect(out.n).toBe(4);
    expect(out.n_choices).toBe(8);
    expect(out.attributes).toHaveLength(2);
    expect(out.recommendation.levels).toHaveLength(2);
    expect(out.statistical_inference).toBe(false);
    expect(out.limitation_note).toBe(CJ_LIMITATION);
    const price = out.attributes.find((attr) => attr.name === 'price');
    expect(price?.levels.some((level) => level.label === '99k' && level.count === 4)).toBe(true);
  });

  it('M1-1b: 4 choices from 2 respondents → cj_insufficient_n', () => {
    expect(() =>
      computeConjointLite([FIXTURE[0], FIXTURE[1], FIXTURE[2], FIXTURE[3]]),
    ).toThrow('cj_insufficient_n');
  });

  it('M1-1c: 3 choices → cj_insufficient_choices', () => {
    expect(() => computeConjointLite(FIXTURE.slice(0, 3))).toThrow('cj_insufficient_choices');
  });
});

describe('choicesFromCjEvidence', () => {
  it('M1-2: groups C- locators into choices', () => {
    const rows = [
      {
        locator: 'C-R001:task-1:price',
        value_base: 'price',
        unit: '99k',
        value_num: 1,
      },
      {
        locator: 'C-R001:task-1:pack_size',
        value_base: 'pack_size',
        unit: '500ml',
        value_num: 1,
      },
      {
        locator: 'C-R002:task-1:price',
        value_base: 'price',
        unit: '89k',
        value_num: 1,
      },
      {
        locator: 'C-R002:task-1:pack_size',
        value_base: 'pack_size',
        unit: '500ml',
        value_num: 1,
      },
    ];
    const choices = choicesFromCjEvidence(rows);
    expect(choices).toHaveLength(2);
    expect(choices[0].attributes.price).toBe('99k');
    expect(choices[0].attributes.pack_size).toBe('500ml');
  });
});
