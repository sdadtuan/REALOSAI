import {
  fetchTalkwalkerSearchResults,
  type TalkwalkerHttpTransport,
} from './talkwalker-client.util';

/** Talkwalker search fetch. Tests mock fetchTalkwalkerSearchResults via jest.mock on client. */
export async function collectTalkwalker(input: {
  query: string;
  accessToken: string;
  projectId: string;
  limit?: number;
  transport?: TalkwalkerHttpTransport;
}) {
  return fetchTalkwalkerSearchResults(
    {
      query: input.query,
      accessToken: input.accessToken,
      projectId: input.projectId,
      limit: input.limit,
    },
    input.transport,
  );
}
