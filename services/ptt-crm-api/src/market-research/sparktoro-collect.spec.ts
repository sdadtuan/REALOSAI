import { collectSparkToro } from './sparktoro-collect';
import * as client from './sparktoro-client.util';

jest.mock('./sparktoro-client.util');

describe('collectSparkToro', () => {
  it('returns results from fetchSparktoroAudienceWebsites', async () => {
    (client.fetchSparktoroAudienceWebsites as jest.Mock).mockResolvedValue({
      results: [{ url: 'https://a.com', title: 'a.com', snippet: 'x' }],
      credits_used: 12,
      report_id: 'r1',
      location: 'us',
    });
    (client.resolveSparktoroLocation as jest.Mock).mockReturnValue('us');

    const out = await collectSparkToro({ query: 'Q VN', apiKey: 'k', geo: ['VN'] });

    expect(out.results).toHaveLength(1);
    expect(out.credits_used).toBe(12);
    expect(out.report_id).toBe('r1');
    expect(client.fetchSparktoroAudienceWebsites).toHaveBeenCalledWith({
      query: 'Q VN',
      apiKey: 'k',
      location: 'us',
    });
  });
});
