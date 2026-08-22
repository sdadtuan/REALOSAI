import { parseCodebookCsv, parseConjointCsv, conjointDraftsFromChoices } from './survey-codebook.util';

const CODEBOOK_HEADER =
  'respondent_id,question_code,value,unit,value_base,period_note,geography';

describe('parseCodebookCsv', () => {
  it('M1-1a: 2 valid codebook rows → 2 drafts with locator Q-Q1', () => {
    const csv = [
      CODEBOOK_HEADER,
      'R001,Q1,15000,VND,mean,2026-Q1,VN',
      'R002,Q1,18000,VND,mean,2026-Q1,VN',
    ].join('\n');

    const drafts = parseCodebookCsv(csv);

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toEqual({
      locator: 'Q-Q1',
      value_num: 15000,
      unit: 'VND',
      value_base: 'mean',
      period_note: '2026-Q1',
      geography: 'VN',
      respondent_id: 'R001',
    });
    expect(drafts[1].locator).toBe('Q-Q1');
    expect(drafts[1].value_num).toBe(18000);
    expect(drafts[1].respondent_id).toBe('R002');
  });

  it('M1-1b: cell analyst@ptt.vn → survey_pii_forbidden', () => {
    const csv = [
      CODEBOOK_HEADER,
      'R001,Q1,15000,VND,mean,2026-Q1,analyst@ptt.vn',
    ].join('\n');

    expect(() => parseCodebookCsv(csv)).toThrow('survey_pii_forbidden');
    try {
      parseCodebookCsv(csv);
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('survey_pii_forbidden');
    }
  });

  it('M1-1c: 501 data rows → codebook_row_cap', () => {
    const rows = [CODEBOOK_HEADER];
    for (let i = 1; i <= 501; i += 1) {
      rows.push(`R${String(i).padStart(3, '0')},Q1,${i},VND,mean,2026-Q1,VN`);
    }

    expect(() => parseCodebookCsv(rows.join('\n'))).toThrow('codebook_row_cap');
    try {
      parseCodebookCsv(rows.join('\n'));
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('codebook_row_cap');
    }
  });

  it('M1-1d: wrong header → codebook_csv_invalid', () => {
    const csv = ['id,q,val', 'R001,Q1,15000'].join('\n');

    expect(() => parseCodebookCsv(csv)).toThrow('codebook_csv_invalid');
    try {
      parseCodebookCsv(csv);
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('codebook_csv_invalid');
    }
  });

  it('P21 parseConjointCsv maps choices and drafts', () => {
    const csv = [
      'respondent_id,task_id,price,pack_size',
      'R001,1,99k,500ml',
      'R001,2,89k,500ml',
      'R002,1,99k,1L',
      'R002,2,89k,1L',
      'R003,1,99k,500ml',
      'R003,2,99k,1L',
      'R004,1,89k,500ml',
      'R004,2,89k,500ml',
    ].join('\n');
    const choices = parseConjointCsv(csv);
    expect(choices).toHaveLength(8);
    const drafts = conjointDraftsFromChoices(choices, '2026-Q1', 'VN');
    expect(drafts[0].locator).toBe('C-R001:task-1:price');
    expect(drafts[0].unit).toBe('99k');
  });

  it('P21 parseConjointCsv with 1 attribute → cj_too_few_attributes', () => {
    const csv = ['respondent_id,task_id,price', 'R001,1,99k'].join('\n');
    expect(() => parseConjointCsv(csv)).toThrow('cj_too_few_attributes');
  });
});
