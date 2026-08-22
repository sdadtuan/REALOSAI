import { collectQualtrics } from './qualtrics-collect';
import * as client from './qualtrics-client.util';

jest.mock('./qualtrics-client.util', () => ({
  fetchQualtricsExportCsv: jest.fn(),
}));

describe('collectQualtrics', () => {
  it('returns drafts from export csv and column map', async () => {
    (client.fetchQualtricsExportCsv as jest.Mock).mockResolvedValue({
      csvText: 'ResponseId,QID1\nRSP_001,42\n',
      progress_id: 'ES_1',
      file_id: 'FILE_1',
    });
    const out = await collectQualtrics({
      surveyId: 'SV_test',
      apiKey: 'k',
      datacenter: 'iad1',
      columnMap: {
        QID1: {
          question_code: 'Q1',
          unit: 'VND',
          value_base: 'mean',
          period_note: '2026-Q1',
          geography: 'VN',
        },
      },
    });
    expect(out.drafts.length).toBeGreaterThanOrEqual(1);
    expect(out.drafts[0].locator).toBe('Q-Q1');
    expect(out.progress_id).toBe('ES_1');
  });
});
