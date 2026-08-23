export type BdsPwaTab = 'leads' | 'units' | 'holds';

export const BDS_PWA_BASE = '/crm/bds/pwa';

export function bdsPwaTabHref(tab: BdsPwaTab, leadId?: number): string {
  if (tab === 'leads') return BDS_PWA_BASE;
  if (tab === 'units') {
    const qs = leadId != null && leadId > 0 ? `?lead=${leadId}` : '';
    return `${BDS_PWA_BASE}/units${qs}`;
  }
  return `${BDS_PWA_BASE}/holds`;
}

export function bdsPwaActiveTab(pathname: string): BdsPwaTab {
  if (pathname.includes('/units')) return 'units';
  if (pathname.includes('/holds')) return 'holds';
  return 'leads';
}
