export const CODEBOOK_IMPORT_BANNER =
  'Nhập CSV codebook — evidence số. Không tự tạo insight.';

export const CODEBOOK_CSV_ACCEPT = '.csv,text/csv';

export const SURVEY_IMPORT_FORMATS = ['codebook', 'vw', 'conjoint'] as const;
export type SurveyImportFormat = (typeof SURVEY_IMPORT_FORMATS)[number];

export function surveyImportFormatsForProduct(productType: string): SurveyImportFormat[] {
  const base: SurveyImportFormat[] = ['codebook', 'vw'];
  if (productType === 'PRICE_OFFER') {
    return [...base, 'conjoint'];
  }
  return base;
}

export const DEFAULT_VW_UNIT = 'VND';

export const CODEBOOK_IMPORT_DISABLED_TITLE = 'Cần quyền chỉnh sửa nghiên cứu';

export const EXPERT_REVIEW_PLACEHOLDER = 'Ghi chú nguồn / limitation (ExpertReview)';

const CSV_NAME = /\.csv$/i;
const CSV_MIMES = new Set(['text/csv', 'application/csv']);

export function isCodebookCsvFile(file: { name?: string; type?: string }): boolean {
  const name = String(file.name ?? '').trim();
  const mime = String(file.type ?? '').trim().toLowerCase();
  return CSV_NAME.test(name) || CSV_MIMES.has(mime);
}

export function isVwGeographyMissing(format: string, geography: string): boolean {
  if (format !== 'vw') return false;
  return String(geography ?? '').trim() === '';
}

export function surveyStudiesForImport<T extends { method: string }>(studies: T[]): T[] {
  return studies.filter((row) => row.method === 'survey');
}
