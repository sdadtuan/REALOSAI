import {
  computePlannerSourceHash,
  extractIdeasFromPlanner,
  extractPillarsFromPlanner,
  mapPlannerChannelFormat,
} from './content-plan-snapshot.util';
import type { PlannerIngestSource } from './content-plan-snapshot.util';

describe('content-plan-snapshot.util', () => {
  const source: PlannerIngestSource = {
    marketing_plan_id: 88,
    brief_json: { brand_name: 'Acme', objective: 'lead', usp: 'Fast' },
    content_json: {
      calendar: [
        { title: 'Blog post A', type: 'blog', channel: 'website', goal: 'lead', copy: 'Hook A' },
        { title: 'FB post B', type: 'social_post', channel: 'Meta', goal: 'engagement', copy: 'Hook B' },
      ],
      ad_copy: [{ headline: 'Ad 1', body: 'CTA now' }],
    },
    campaigns_json: [{ name: 'Launch', objective: 'lead', kpis: ['CPL'] }],
    strategy_framework_json: { positioning: 'Leader in X' },
    target_market_prof_json: {},
  };

  it('computePlannerSourceHash is stable', () => {
    const h1 = computePlannerSourceHash(source);
    const h2 = computePlannerSourceHash(source);
    expect(h1).toBe(h2);
    expect(h1.length).toBe(32);
  });

  it('extractPillarsFromPlanner includes campaigns and fallback', () => {
    const pillars = extractPillarsFromPlanner(source);
    expect(pillars.length).toBeGreaterThan(0);
    expect(pillars.some((p) => p.name === 'Launch')).toBe(true);
  });

  it('extractIdeasFromPlanner maps calendar and ad_copy', () => {
    const ideas = extractIdeasFromPlanner(source, { importCalendar: true });
    expect(ideas.length).toBe(3);
    expect(ideas[0].channel_hints).toContain('website');
  });

  it('mapPlannerChannelFormat maps Meta social', () => {
    expect(mapPlannerChannelFormat('social_post', 'Meta')).toEqual({
      channel: 'facebook',
      format: 'social_post',
    });
  });
});
