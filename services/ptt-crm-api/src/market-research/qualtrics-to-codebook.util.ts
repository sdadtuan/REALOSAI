import { parseCsv } from './survey-codebook.util';
import type { QualtricsColumnMapEntry } from './market-research.types';

const CODEBOOK_HEADER =
  'respondent_id,question_code,value,unit,value_base,period_note,geography';

const MAX_DATA_ROWS = 500;

function respondentColumnIndex(header: string[]): number {
  const idx = header.findIndex((col) => col.trim().toLowerCase() === 'responseid');
  return idx >= 0 ? idx : 0;
}

export function wideCsvToCodebookCsv(
  wideCsv: string,
  columnMap: Record<string, QualtricsColumnMapEntry>,
): string {
  const rows = parseCsv(wideCsv);
  if (!rows.length) return CODEBOOK_HEADER;
  const header = rows[0];
  const respIdx = respondentColumnIndex(header);
  const out: string[] = [CODEBOOK_HEADER];
  let dataRows = 0;
  for (const cells of rows.slice(1)) {
    if (dataRows >= MAX_DATA_ROWS) break;
    const respondent = String(cells[respIdx] ?? '').trim();
    if (!respondent) continue;
    for (let col = 0; col < header.length; col += 1) {
      if (col === respIdx) continue;
      const qid = header[col]?.trim();
      if (!qid) continue;
      const mapping = columnMap[qid];
      if (!mapping) continue;
      const raw = String(cells[col] ?? '').trim();
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      const period = String(mapping.period_note ?? '').trim();
      const geo = String(mapping.geography ?? '').trim();
      out.push(
        [
          respondent,
          mapping.question_code,
          String(value),
          mapping.unit,
          mapping.value_base,
          period,
          geo,
        ].join(','),
      );
      dataRows += 1;
      if (dataRows >= MAX_DATA_ROWS) break;
    }
  }
  return out.join('\n');
}
