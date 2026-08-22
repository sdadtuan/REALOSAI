const ON = new Set(['1', 'true', 'yes', 'on']);

export function envFlagOn(raw: string | undefined): boolean {
  return ON.has(String(raw ?? '0').trim().toLowerCase());
}

export function isBdsPackEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_PACK);
}

export function isBdsPgEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_PG);
}

export function isBdsProjectOsEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_PROJECT_OS);
}
