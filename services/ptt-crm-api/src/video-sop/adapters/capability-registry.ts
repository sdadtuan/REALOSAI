import type { VdModelRegistryRow } from './i-provider';

export type CapabilityEntry = {
  model_key: string;
  capability_json: Record<string, unknown>;
};

export type CapabilityRegistryDeps = {
  listModels: () => Promise<VdModelRegistryRow[]>;
};

export class CapabilityRegistry {
  constructor(private readonly deps: CapabilityRegistryDeps) {}

  async capabilities(): Promise<CapabilityEntry[]> {
    const rows = await this.deps.listModels();
    return rows
      .filter((row) => row.capability_json.status !== 'DISABLED')
      .map((row) => ({
        model_key: row.code,
        capability_json: row.capability_json,
      }));
  }
}
