import type { ReportExec } from './market-research.types';

export function normalizeReportExec(raw: unknown): ReportExec {
  if (typeof raw === 'string') {
    return { vi: raw, en: null, en_status: 'none' };
  }
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const vi = String(obj.vi ?? obj.exec ?? '').trim();
  const en = obj.en == null ? null : String(obj.en).trim() || null;
  const st = obj.en_status;
  const en_status = st === 'draft' || st === 'approved' || st === 'none' ? st : en ? 'draft' : 'none';
  return { vi, en, en_status };
}

export function assertExecEnEditable(exec: ReportExec): void {
  if (exec.en_status === 'approved') {
    throw Object.assign(new Error('exec_en_locked'), { code: 'exec_en_locked' });
  }
}
