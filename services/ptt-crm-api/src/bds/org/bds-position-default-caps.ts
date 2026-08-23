import type { StaffSectionCap } from '../../staff-auth/staff-auth.types';

const v = (section: string, ...actions: string[]): StaffSectionCap[] =>
  actions.map((action) => ({ section, action }));

export const BDS_POSITION_DEFAULT_CAPS: Record<string, readonly StaffSectionCap[]> = {
  tgd: [
    ...v('bds_tenant', 'view'),
    ...v('bds_holds', 'view'),
    ...v('bds_launches', 'view'),
    ...v('bds_transactions', 'view'),
    ...v('bds_collections', 'view'),
    ...v('bds_project_os', 'view'),
    ...v('bds_aftersales', 'view'),
  ],
  gdkd: [
    ...v('bds_tenant', 'view'),
    ...v('bds_holds', 'view', 'approve', 'cancel'),
    ...v('bds_policies', 'view', 'approve'),
    ...v('bds_launches', 'view', 'open'),
    ...v('bds_agency_tiers', 'view', 'override'),
    ...v('bds_transactions', 'view'),
    ...v('bds_buyers', 'view'),
    ...v('bds_agencies', 'view'),
  ],
  pm_du_an: [
    ...v('bds_project_os', 'view', 'edit', 'approve'),
    ...v('bds_launches', 'view', 'create', 'open'),
    ...v('bds_legal', 'view'),
    ...v('bds_inventory', 'view'),
  ],
  truong_sp: [
    ...v('bds_inventory', 'view', 'create', 'edit', 'import', 'lock'),
    ...v('bds_policies', 'view', 'create', 'edit'),
    ...v('bds_baskets', 'view', 'create', 'edit'),
  ],
  cv_gia: [...v('bds_policies', 'view', 'create', 'edit'), ...v('bds_inventory', 'view')],
  truong_inhouse: [
    ...v('bds_holds', 'view', 'create', 'cancel'),
    ...v('bds_buyers', 'view', 'edit'),
    ...v('bds_transactions', 'view', 'create'),
  ],
  tvv_inhouse: [
    ...v('bds_holds', 'view', 'create'),
    ...v('bds_buyers', 'view'),
    ...v('bds_transactions', 'view', 'create'),
  ],
  truong_kenh: [
    ...v('bds_agencies', 'view', 'create', 'edit', 'suspend'),
    ...v('bds_baskets', 'view', 'create', 'edit'),
    ...v('bds_agency_tiers', 'view', 'configure'),
    ...v('bds_holds', 'view', 'create'),
    ...v('bds_commission', 'view'),
  ],
  am_kenh: [
    ...v('bds_agencies', 'view', 'edit'),
    ...v('bds_baskets', 'view'),
    ...v('bds_holds', 'view', 'create'),
    ...v('bds_buyers', 'view'),
  ],
  cskh_lead: [...v('bds_buyers', 'view', 'edit', 'view_pii')],
  truong_mkt: [
    ...v('bds_buyers', 'view'),
    ...v('bds_project_os', 'view', 'edit'),
    ...v('bds_launches', 'view'),
  ],
  truong_pc: [
    ...v('bds_legal', 'view', 'edit', 'approve'),
    ...v('bds_transactions', 'view', 'edit'),
    ...v('bds_agencies', 'view'),
  ],
  cv_hd: [...v('bds_legal', 'view'), ...v('bds_transactions', 'view', 'edit')],
  truong_collection: [
    ...v('bds_collections', 'view', 'create', 'export'),
    ...v('bds_transactions', 'view'),
  ],
  cv_hh: [...v('bds_commission', 'view', 'approve', 'export', 'payout')],
  truong_after: [...v('bds_aftersales', 'view', 'edit', 'approve')],
  cv_ban_giao: [...v('bds_aftersales', 'view', 'edit')],
  hr_bp: [...v('bds_tenant', 'view')],
};

export function capsForPosition(code: string): StaffSectionCap[] {
  return [...(BDS_POSITION_DEFAULT_CAPS[code] ?? [])];
}
