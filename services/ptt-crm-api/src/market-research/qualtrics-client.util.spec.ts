import fs from 'node:fs';
import path from 'node:path';
import { fetchQualtricsExportCsv } from './qualtrics-client.util';

describe('qualtrics-client.util', () => {
  it('fetchQualtricsExportCsv start poll download', async () => {
    const csv = 'ResponseId,QID1\nRSP_001,42\n';
    const transport = async (req: {
      method: string;
      url: string;
      body?: unknown;
      binary?: boolean;
    }) => {
      if (req.url.includes('/export-responses') && req.method === 'POST') {
        return { status: 200, json: async () => ({ result: { progressId: 'ES_1' } }) };
      }
      if (req.url.includes('/export-responses/ES_1') && req.method === 'GET' && !req.url.endsWith('/file')) {
        return { status: 200, json: async () => ({ result: { status: 'complete', fileId: 'FILE_1' } }) };
      }
      if (req.url.endsWith('/file')) {
        return {
          status: 200,
          json: async () => ({}),
          arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
        };
      }
      return { status: 404, json: async () => ({}) };
    };
    const out = await fetchQualtricsExportCsv(
      { surveyId: 'SV_test', apiKey: 'k', datacenter: 'iad1' },
      transport,
    );
    expect(out.csvText).toContain('RSP_001');
    expect(out.file_id).toBe('FILE_1');
  });
});
