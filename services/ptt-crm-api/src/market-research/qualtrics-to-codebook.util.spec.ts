import fs from 'node:fs';
import path from 'node:path';
import { wideCsvToCodebookCsv } from './qualtrics-to-codebook.util';

describe('qualtrics-to-codebook.util', () => {
  const root = path.join(__dirname, '../../../../scripts/fixtures');

  it('wideCsvToCodebookCsv emits codebook header and rows', () => {
    const csv = fs.readFileSync(path.join(root, 'qualtrics-export.sample.csv'), 'utf8');
    const map = JSON.parse(
      fs.readFileSync(path.join(root, 'qualtrics-column-map.sample.json'), 'utf8'),
    );
    const out = wideCsvToCodebookCsv(csv, map);
    expect(out).toContain('respondent_id,question_code,value,unit,value_base');
    expect(out).toContain('RSP_001,Q1,42,VND,mean');
    expect(out).toContain('RSP_002,Q1,55,VND,mean');
  });
});
