export type BdsTenantMode = 'developer' | 'broker' | 'hybrid';

export type IndustryPack = {
  slug: 'bds';
  leadFlowKind: 're_buyer';
  tenantModes: BdsTenantMode[];
};

export const BDS_PACK: IndustryPack = {
  slug: 'bds',
  leadFlowKind: 're_buyer',
  tenantModes: ['developer', 'broker', 'hybrid'],
};

export function mapWonToRevenue(tx: { type: string; amountVnd: number }): {
  kind: 'pipeline' | 'revenue';
  amountVnd: number;
} {
  if (tx.type === 'contracted') {
    return { kind: 'revenue', amountVnd: tx.amountVnd };
  }
  return { kind: 'pipeline', amountVnd: tx.amountVnd };
}
