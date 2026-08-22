import { CapabilityRegistry } from './capability-registry';

describe('CapabilityRegistry', () => {
  it('capabilities read from registry not hardcoded', async () => {
    const rows = [
      { code: 'video.runway.gen45', capability_json: { status: 'ACTIVE', capability: 'VIDEO_GEN' } },
      { code: 'old.model', capability_json: { status: 'DISABLED' } },
    ];
    const reg = new CapabilityRegistry({ listModels: async () => rows });
    const caps = await reg.capabilities();
    expect(caps.map((c) => c.model_key)).toEqual(['video.runway.gen45']);
  });
});
