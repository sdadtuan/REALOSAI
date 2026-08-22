import {
  buildMktAiPilotContext,
  isMktAiPilotServiceSlug,
  MKT_AI_PILOT_SERVICE_SLUGS_DEFAULT,
  parseMktAiPilotServiceSlugs,
} from './mkt-ai-pilot.util';

describe('mkt-ai-pilot.util', () => {
  it('defaults to pilot slug set', () => {
    expect(parseMktAiPilotServiceSlugs('')).toEqual([...MKT_AI_PILOT_SERVICE_SLUGS_DEFAULT]);
  });

  it('respects env override', () => {
    expect(parseMktAiPilotServiceSlugs('meta-lead-gen,custom-slug')).toEqual([
      'meta-lead-gen',
      'custom-slug',
    ]);
  });

  it('blocks non-pilot slug when pilot_only', () => {
    const ctx = buildMktAiPilotContext('unknown-slug', true, MKT_AI_PILOT_SERVICE_SLUGS_DEFAULT);
    expect(ctx.service_slug_in_pilot).toBe(false);
    expect(ctx.ga_blocked_message_vi).toContain('pilot');
  });

  it('allows pilot slug', () => {
    expect(isMktAiPilotServiceSlug('tiep-thi-noi-dung', MKT_AI_PILOT_SERVICE_SLUGS_DEFAULT)).toBe(true);
  });
});
