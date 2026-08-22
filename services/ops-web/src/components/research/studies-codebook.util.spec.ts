import { describe, expect, it } from 'vitest';
import {
  CODEBOOK_CSV_ACCEPT,
  CODEBOOK_IMPORT_BANNER,
  CODEBOOK_IMPORT_DISABLED_TITLE,
  DEFAULT_VW_UNIT,
  EXPERT_REVIEW_PLACEHOLDER,
  SURVEY_IMPORT_FORMATS,
  isCodebookCsvFile,
  isVwGeographyMissing,
  surveyStudiesForImport,
  surveyImportFormatsForProduct,
} from './studies-codebook.util';

describe('studies-codebook.util', () => {
  it('keeps codebook import banner verbatim', () => {
    expect(CODEBOOK_IMPORT_BANNER).toBe(
      'Nhập CSV codebook — evidence số. Không tự tạo insight.',
    );
  });

  it('accepts CSV files only and rejects other types before POST', () => {
    expect(CODEBOOK_CSV_ACCEPT).toBe('.csv,text/csv');
    expect(isCodebookCsvFile({ name: 'codebook.csv', type: 'text/csv' })).toBe(true);
    expect(isCodebookCsvFile({ name: 'codebook.CSV', type: '' })).toBe(true);
    expect(isCodebookCsvFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
    expect(isCodebookCsvFile({ name: 'book.xlsx', type: 'application/vnd.ms-excel' })).toBe(false);
  });

  it('lists codebook, vw, and conjoint formats for PRICE_OFFER', () => {
    expect(SURVEY_IMPORT_FORMATS).toEqual(['codebook', 'vw', 'conjoint']);
    expect(surveyImportFormatsForProduct('PRICE_OFFER')).toEqual(['codebook', 'vw', 'conjoint']);
    expect(surveyImportFormatsForProduct('CAT_REVIEW')).toEqual(['codebook', 'vw']);
    expect(DEFAULT_VW_UNIT).toBe('VND');
  });

  it('requires geography only when format is vw', () => {
    expect(isVwGeographyMissing('vw', '')).toBe(true);
    expect(isVwGeographyMissing('vw', '   ')).toBe(true);
    expect(isVwGeographyMissing('vw', 'VN')).toBe(false);
    expect(isVwGeographyMissing('codebook', '')).toBe(false);
  });

  it('keeps ExpertReview placeholder as a source note without the word insight', () => {
    expect(EXPERT_REVIEW_PLACEHOLDER.toLowerCase()).not.toContain('insight');
    expect(CODEBOOK_IMPORT_DISABLED_TITLE).toBe('Cần quyền chỉnh sửa nghiên cứu');
  });

  it('offers only survey studies for optional study_id', () => {
    expect(
      surveyStudiesForImport([
        { id: 1, method: 'survey' },
        { id: 2, method: 'idi' },
        { id: 3, method: 'fgd' },
        { id: 4, method: 'survey' },
      ]).map((row) => row.id),
    ).toEqual([1, 4]);
  });
});
