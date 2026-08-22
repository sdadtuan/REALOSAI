import fs from 'node:fs';
import path from 'node:path';
import {
  fetchSparktoroAudienceWebsites,
  normalizeSparktoroWebsites,
  resolveSparktoroLocation,
  type SparktoroHttpTransport,
} from './sparktoro-client.util';

describe('sparktoro-client.util', () => {
  const root = path.join(__dirname, '../../../../scripts/fixtures');
  const raw = JSON.parse(
    fs.readFileSync(path.join(root, 'sparktoro-websites.sample.json'), 'utf8'),
  );

  it('resolveSparktoroLocation maps geo tokens', () => {
    expect(resolveSparktoroLocation(['VN'])).toBe('us');
    expect(resolveSparktoroLocation(['UK'])).toBe('uk');
    expect(resolveSparktoroLocation(['CA'])).toBe('ca');
  });

  it('normalizeSparktoroWebsites maps data[] to collect results', () => {
    const out = normalizeSparktoroWebsites(raw);
    expect(out.results).toHaveLength(2);
    expect(out.results[0]).toEqual({
      url: 'https://example.com',
      title: 'example.com',
      snippet: 'Example audience site.',
    });
    expect(out.results[1].snippet).toContain('Affinity 18%');
    expect(out.credits_charged).toBe(2);
  });

  it('fetchSparktoroAudienceWebsites create then websites', async () => {
    const calls: string[] = [];
    const transport: SparktoroHttpTransport = async (input) => {
      calls.push(`${input.method} ${input.url}`);
      if (input.url.endsWith('/v3/describe/create')) {
        return { status: 200, json: async () => ({ report_id: 'rpt-1', status: 'ready' }) };
      }
      if (input.url.includes('/v3/websites')) {
        return { status: 200, json: async () => raw };
      }
      return { status: 404, json: async () => ({}) };
    };
    const out = await fetchSparktoroAudienceWebsites(
      { query: 'B2B founders VN', apiKey: 'k', location: 'us', limit: 10 },
      transport,
    );
    expect(out.report_id).toBe('rpt-1');
    expect(out.results).toHaveLength(2);
    expect(out.credits_used).toBeGreaterThanOrEqual(12);
    expect(calls[0]).toContain('/v3/describe/create');
    expect(calls[1]).toContain('/v3/websites');
  });
});
