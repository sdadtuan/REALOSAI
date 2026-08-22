const CMKT_CHANNEL_HINTS = [
  'facebook',
  'linkedin',
  'website',
  'newsletter',
  'drip',
  'youtube',
  'short_video',
  'zalo_oa',
  'meta_ads',
  'google_ads',
] as const;

export type ParsedSuggestionIdea = {
  title: string;
  hook: string;
  target_goal: string;
  channel_hints: string[];
  pillar_name: string | null;
};

export function parseSuggestionToIdea(input: {
  suggestion: string;
  pillarNames: string[];
}): ParsedSuggestionIdea {
  const hook = input.suggestion.trim();
  const title = hook.length > 120 ? `${hook.slice(0, 117)}...` : hook;

  const pillarMatch = /pillar\s+"([^"]+)"/i.exec(hook);
  const pillar_name =
    pillarMatch?.[1]?.trim() ??
    input.pillarNames.find((p) => hook.toLowerCase().includes(p.toLowerCase())) ??
    input.pillarNames[0] ??
    null;

  const lower = hook.toLowerCase();
  const channel_hints = CMKT_CHANNEL_HINTS.filter((c) => lower.includes(c));

  let target_goal = 'engagement';
  if (lower.includes('lead') || lower.includes('cta')) {
    target_goal = 'lead';
  } else if (lower.includes('awareness') || lower.includes('educational')) {
    target_goal = 'awareness';
  }

  return { title, hook, target_goal, channel_hints: [...channel_hints], pillar_name };
}
