import {
  fetchSparktoroAudienceWebsites,
  resolveSparktoroLocation,
} from './sparktoro-client.util';

/** SparkToro audience websites fetch. Tests replace fetchSparktoroAudienceWebsites via jest.mock on client. */

export async function collectSparkToro(input: {
  query: string;
  apiKey: string;
  geo?: string[];
}): Promise<{
  results: Array<{ url: string; title: string; snippet: string }>;
  credits_used?: number;
  report_id?: string | null;
  location?: string;
}> {
  const location = resolveSparktoroLocation(input.geo ?? []);
  return fetchSparktoroAudienceWebsites({
    query: input.query,
    apiKey: input.apiKey,
    location,
  });
}
