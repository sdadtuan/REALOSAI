import { CJ_WHATIF_LIMITATION } from './market-research.types';
import { simulateConjointWhatIf } from './conjoint-whatif.util';
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

describe('simulateConjointWhatIf', () => {
  it('P34 matches AND scenario on fixture', () => {
    const out = simulateConjointWhatIf(FIXTURE, { price: '99k', pack_size: '500ml' });
    expect(out).toMatchObject({
      n_match: 2,
      n_choices: 8,
      match_pct: 25,
      statistical_inference: false,
      scenario: { price: '99k', pack_size: '500ml' },
    });
    expect(out.limitation_note).toBe(CJ_WHATIF_LIMITATION);
    expect(out.limitation_note).not.toMatch(/\bMOE\b|95\s*%\s*confidence/i);
  });

  it('P34 partial scenario counts one attribute', () => {
    const out = simulateConjointWhatIf(FIXTURE, { price: '89k' });
    expect(out).toMatchObject({ n_match: 4, n_choices: 8, match_pct: 50 });
  });

  it('P34 unknown level is zero matches', () => {
    const out = simulateConjointWhatIf(FIXTURE, { price: '79k', pack_size: '500ml' });
    expect(out.n_match).toBe(0);
    expect(out.match_pct).toBe(0);
  });

  it('P34 empty scenario throws cj_whatif_empty', () => {
    expect(() => simulateConjointWhatIf(FIXTURE, {})).toThrow('cj_whatif_empty');
    expect(() => simulateConjointWhatIf(FIXTURE, { price: '  ' })).toThrow('cj_whatif_empty');
  });

  it('P34 unknown attribute throws cj_whatif_unknown_attribute', () => {
    expect(() => simulateConjointWhatIf(FIXTURE, { color: 'red' })).toThrow(
      'cj_whatif_unknown_attribute',
    );
  });

  it('P34 empty choices throws cj_whatif_no_choices', () => {
    expect(() => simulateConjointWhatIf([], { price: '99k' })).toThrow('cj_whatif_no_choices');
  });
});
