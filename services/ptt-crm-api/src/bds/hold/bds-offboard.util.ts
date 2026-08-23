const OPEN_HOLD = new Set(['pending', 'active']);
const DEPOSIT_LOCK = new Set([
  'deposit',
  'vbtt',
  'contracted',
  'handed_over',
  'title_issued',
]);

const LEAD_POSITION: Record<string, string> = {
  ban_tgd: 'tgd',
  ban_du_an: 'pm_du_an',
  ban_san_pham: 'truong_sp',
  ban_kd: 'truong_inhouse',
  ban_kenh: 'truong_kenh',
  ban_cskh_presales: 'cskh_lead',
  ban_mkt: 'truong_mkt',
  ban_phap_che: 'truong_pc',
  ban_tc_collection: 'truong_collection',
  ban_tc_hh: 'cv_hh',
  ban_cskh_after: 'truong_after',
  ban_hr: 'hr_bp',
};

export function shouldReleaseHoldOnOffboard(input: {
  holdStatus: string;
  txStage: string | null | undefined;
}): boolean {
  if (!OPEN_HOLD.has(String(input.holdStatus))) return false;
  if (DEPOSIT_LOCK.has(String(input.txStage ?? ''))) return false;
  return true;
}

export function offboardLeadPositionCode(deptCode: string): string {
  return LEAD_POSITION[String(deptCode ?? '').trim()] ?? 'truong';
}

export const OFFBOARD_HOLD_REASON = 'offboard hold';
