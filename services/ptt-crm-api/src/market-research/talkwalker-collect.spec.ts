import { collectTalkwalker } from './talkwalker-collect';
import * as client from './talkwalker-client.util';

jest.mock('./talkwalker-client.util');

describe('talkwalker-collect', () => {
  it('returns results from fetchTalkwalkerSearchResults', async () => {
    (client.fetchTalkwalkerSearchResults as jest.Mock).mockResolvedValue({
      results: [{ url: 'https://x', title: 't', snippet: 's' }],
    });
    const out = await collectTalkwalker({
      query: 'giá sữa',
      accessToken: 'tok',
      projectId: 'proj1',
    });
    expect(out.results).toHaveLength(1);
    expect(client.fetchTalkwalkerSearchResults).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'giá sữa', accessToken: 'tok', projectId: 'proj1' }),
      undefined,
    );
  });
});
