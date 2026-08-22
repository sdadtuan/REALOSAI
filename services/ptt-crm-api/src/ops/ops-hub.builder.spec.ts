import { buildEngineHref, buildOpsHubPayload } from './ops-hub.builder';
import type { OpsRouteMapService, OpsServiceProfileRow } from './ops.types';

describe('ops-hub.builder', () => {
  const dv02: OpsRouteMapService = {
    code: 'DV02',
    name_vi: 'Chiến lược nội dung',
    readiness: 'ready',
    service_slugs: { primary: 'tiep-thi-noi-dung', alternates: [] },
    ops_web: {
      execution: [
        {
          route: '/crm/service-delivery/{lifecycleId}?tab=content-os',
          purpose: 'Content OS',
        },
      ],
    },
  };

  const profile: OpsServiceProfileRow = {
    id: 1,
    dv_code: 'DV02',
    service_slug: 'tiep-thi-noi-dung',
    name: 'Chiến lược nội dung',
    readiness: 'ready',
    service_slugs_json: {},
    ops_web_json: dv02.ops_web as Record<string, unknown>,
    nest_api_json: {},
    weekly_process_template: [],
    kpi_definitions: [],
    tier_pricing: {},
  };

  it('buildEngineHref replaces lifecycleId', () => {
    expect(
      buildEngineHref('/crm/service-delivery/{lifecycleId}?tab=content-os', {
        lifecycleId: 42,
      }),
    ).toBe('/crm/service-delivery/42?tab=content-os');
  });

  it('builds content-os engine link for DV02', () => {
    const payload = buildOpsHubPayload({
      ctx: {
        lifecycleId: 42,
        serviceSlug: 'tiep-thi-noi-dung',
        status: 'active',
        clientName: 'Acme',
        packageTier: 'standard',
      },
      dv: dv02,
      profile,
      flags: {
        opsDvEnabled: true,
        opsWeeklySpawnEnabled: false,
        opsHubPilotDv: new Set(['DV02']),
        opsAgentEnabled: false,
      },
    });
    expect(payload.dv.dv_code).toBe('DV02');
    expect(payload.engines.some((e) => e.href.includes('/42?') || e.href.includes('lifecycleId=42'))).toBe(
      true,
    );
    expect(payload.flags.pilot_dv).toBe(true);
  });

  it('marks gap readiness engines with badge', () => {
    const gapDv: OpsRouteMapService = {
      ...dv02,
      readiness: 'gap',
    };
    const payload = buildOpsHubPayload({
      ctx: {
        lifecycleId: 1,
        serviceSlug: 'tiep-thi-noi-dung',
        status: 'active',
        clientName: '',
        packageTier: 'standard',
      },
      dv: gapDv,
      profile,
      flags: {
        opsDvEnabled: true,
        opsWeeklySpawnEnabled: false,
        opsHubPilotDv: new Set(),
        opsAgentEnabled: false,
      },
    });
    expect(payload.engines.every((e) => e.status === 'gap' || e.badge)).toBe(true);
  });
});
