'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import { KpiTileGrid, type KpiTileProps } from '@/components/kpi/KpiDashboardUi';
import {
  computePayroll,
  downloadPayrollXlsx,
  exportPayrollJson,
  fetchPayrollAttendance,
  fetchPayrollDashboard,
  fetchPayrollPeriod,
  fetchPayrollPolicy,
  savePayrollPolicy,
  staffMe,
  staffRefresh,
} from '@/lib/api';
import { formatVnd } from '@/lib/kpi/format';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

const POLICY_FIELDS: Array<{ key: string; label: string; type?: string }> = [
  { key: 'shift_start', label: 'Giờ vào ca' },
  { key: 'shift_end', label: 'Giờ tan ca' },
  { key: 'break_minutes_default', label: 'Nghỉ (phút)', type: 'number' },
  { key: 'late_grace_minutes', label: 'Grace trễ (phút)', type: 'number' },
  { key: 'late_penalty_vnd_per_min', label: 'Phạt trễ / phút (VND)', type: 'number' },
  { key: 'late_penalty_max_vnd', label: 'Phạt trễ tối đa (VND)', type: 'number' },
  { key: 'standard_hours_per_day', label: 'Giờ chuẩn / ngày', type: 'number' },
  { key: 'bonus_pct', label: 'Thưởng (%)', type: 'number' },
];

const BONUS_POLICY_FIELDS: Array<{ key: string; label: string; type?: string; options?: string[] }> = [
  { key: 'bonus_mode', label: 'Chế độ thưởng', options: ['none', 'attendance'] },
  { key: 'bonus_min_days', label: 'Ngày công tối thiểu (thưởng)', type: 'number' },
];

export default function CrmPayrollPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<'dashboard' | 'payroll' | 'attendance' | 'policy'>('dashboard');
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [payroll, setPayroll] = useState<Record<string, unknown> | null>(null);
  const [lines, setLines] = useState<Array<Record<string, unknown>>>([]);
  const [attendance, setAttendance] = useState<Array<Record<string, unknown>>>([]);
  const [policy, setPolicy] = useState<Record<string, unknown>>({});
  const [policyDraft, setPolicyDraft] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [computing, setComputing] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      const canView =
        hasCap(me, 'crm_payroll_salary', 'view') ||
        hasCap(me, 'crm_payroll_attendance', 'view') ||
        hasCap(me, 'crm_staff_roster', 'view');
      if (!canView) {
        setError('Không có quyền payroll');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const loadTab = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        if (tab === 'dashboard') {
          setDashboard(await fetchPayrollDashboard(access, { year, month }));
        } else if (tab === 'payroll') {
          const out = await fetchPayrollPeriod(access, year, month);
          setPayroll(out.payroll);
          setLines(out.lines ?? []);
        } else if (tab === 'attendance') {
          setAttendance(await fetchPayrollAttendance(access));
        } else if (tab === 'policy') {
          const p = await fetchPayrollPolicy(access);
          setPolicy(p);
          setPolicyDraft(p);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải payroll thất bại');
      } finally {
        setLoading(false);
      }
    },
    [tab, year, month],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadTab(access);
    })();
  }, [ensureAuth, loadTab]);

  async function onCompute() {
    const access = getAccessToken();
    if (!access) return;
    setComputing(true);
    setError('');
    try {
      const out = await computePayroll(access, { year, month });
      setPayroll(out.payroll);
      setLines(out.lines ?? []);
      setTab('payroll');
      setMessage('Đã tính / cập nhật bảng lương kỳ này.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tính lương thất bại');
    } finally {
      setComputing(false);
    }
  }

  async function onExportExcel() {
    const access = getAccessToken();
    if (!access) return;
    setError('');
    try {
      await downloadPayrollXlsx(access, { year, month });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export Excel thất bại');
    }
  }

  async function onExportJson() {
    const access = getAccessToken();
    if (!access) return;
    setError('');
    try {
      const bundle = await exportPayrollJson(access, { year, month });
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${year}-${month}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export JSON thất bại');
    }
  }

  async function onSavePolicy() {
    const access = getAccessToken();
    if (!access) return;
    setSavingPolicy(true);
    setError('');
    setMessage('');
    try {
      const out = await savePayrollPolicy(access, policyDraft);
      const p = (out.policy as Record<string, unknown>) ?? out;
      setPolicy(p);
      setPolicyDraft(p);
      setMessage('Đã lưu chính sách chấm công.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu chính sách thất bại');
    } finally {
      setSavingPolicy(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const dashboardTiles = useMemo((): KpiTileProps[] => {
    if (!dashboard) return [];
    return [
      { label: 'NV active', value: String(dashboard.staff_active ?? 0) },
      { label: 'Chấm công tháng', value: String(dashboard.attendance_records_month ?? 0) },
      { label: 'Check-in hôm nay', value: String(dashboard.checked_in_today ?? 0) },
      {
        label: 'Trễ tháng',
        value: String(dashboard.late_incidents_month ?? 0),
        tone: Number(dashboard.late_incidents_month ?? 0) > 0 ? 'warning' : 'success',
      },
      { label: 'Giờ làm tháng', value: String(dashboard.total_hours_month ?? 0) },
      { label: 'Ngày công chuẩn', value: String(dashboard.workdays_standard ?? 0) },
    ];
  }, [dashboard]);

  if (!user) {
    return (
      <CrmHrPageShell user={null} onLogout={logout} title="Payroll & chấm công" loading>
        <span />
      </CrmHrPageShell>
    );
  }

  const canEdit = hasCap(user, 'crm_payroll_salary', 'edit');
  const canExport =
    hasCap(user, 'crm_payroll_salary', 'export') ||
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_salary', 'edit');

  return (
    <CrmHrPageShell user={user} onLogout={logout} title="Payroll & chấm công">
      <div className="page-card stack-gap">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Năm"
            className="kpi-input"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            aria-label="Tháng"
            className="kpi-input kpi-input--month"
          />
          {canEdit ? (
            <button type="button" className="btn btn-sm" disabled={computing} onClick={() => void onCompute()}>
              Tính lương
            </button>
          ) : null}
          {canExport ? (
            <>
              <button type="button" className="btn btn-sm" onClick={() => void onExportExcel()}>
                Export Excel
              </button>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onExportJson()}>
                JSON (debug)
              </button>
            </>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {(['dashboard', 'payroll', 'attendance', 'policy'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`btn btn-sm${tab === t ? '' : ' btn-secondary'}`}
              onClick={() => setTab(t)}
            >
              {t === 'dashboard' ? 'Dashboard' : t === 'payroll' ? 'Bảng lương' : t === 'attendance' ? 'Chấm công' : 'Chính sách'}
            </button>
          ))}
        </div>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}

        {tab === 'dashboard' && dashboard ? (
          <>
            <KpiTileGrid tiles={dashboardTiles} />
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Giờ chuẩn tháng: {String(dashboard.standard_hours_month ?? '—')} · Ca:{' '}
              {String((dashboard.policy as Record<string, unknown>)?.shift_start ?? '—')} –{' '}
              {String((dashboard.policy as Record<string, unknown>)?.shift_end ?? '—')}
            </p>
          </>
        ) : null}

        {tab === 'payroll' ? (
          <>
            {payroll ? (
              <p className="muted">
                Kỳ {String(payroll.year)}-{String(payroll.month)} · {String(payroll.status ?? 'draft')}
              </p>
            ) : (
              <p className="muted">Chưa có bảng lương kỳ này — bấm «Tính lương».</p>
            )}
            {lines.length > 0 ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Ngày công</th>
                      <th>Giờ làm</th>
                      <th>Thực lĩnh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={String(line.id ?? i)}>
                        <td>
                          {String(line.staff_name ?? line.staff_id ?? '—')}
                          {line.staff_code ? ` · ${String(line.staff_code)}` : ''}
                        </td>
                        <td>{String(line.days_present ?? '—')}</td>
                        <td>{String(line.hours_worked_total ?? '—')}</td>
                        <td>{formatVnd(Number(line.net_salary_vnd ?? line.gross_vnd ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 'attendance' ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Ngày</th>
                  <th>Vào</th>
                  <th>Ra</th>
                </tr>
              </thead>
              <tbody>
                {attendance.slice(0, 50).map((a, i) => (
                  <tr key={String(a.id ?? i)}>
                    <td>{String(a.staff_name ?? a.staff_id ?? '—')}</td>
                    <td>{String(a.work_date ?? '—')}</td>
                    <td>{String(a.time_in ?? a.check_in ?? '—')}</td>
                    <td>{String(a.time_out ?? a.check_out ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'policy' ? (
          <form
            className="stack-gap"
            onSubmit={(e) => {
              e.preventDefault();
              void onSavePolicy();
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
                gap: '0.75rem',
              }}
            >
              {POLICY_FIELDS.map((field) => (
                <label key={field.key} className="stack-gap" style={{ gap: '0.25rem' }}>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {field.label}
                  </span>
                  <input
                    type={field.type ?? 'text'}
                    className="input"
                    value={String(policyDraft[field.key] ?? '')}
                    readOnly={!canEdit}
                    onChange={(e) =>
                      setPolicyDraft((prev) => ({
                        ...prev,
                        [field.key]:
                          field.type === 'number' ? Number(e.target.value) : e.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <section className="stack-gap win-info-callout" data-testid="payroll-bonus-rules">
              <h3 className="section-title">Quy tắc thưởng (WIN-H-08)</h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {BONUS_POLICY_FIELDS.map((field) => (
                  <label key={field.key} className="stack-gap" style={{ gap: '0.25rem' }}>
                    <span className="muted" style={{ fontSize: '0.85rem' }}>
                      {field.label}
                    </span>
                    {field.options ? (
                      <select
                        className="input"
                        value={String(policyDraft[field.key] ?? field.options[0])}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setPolicyDraft((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                      >
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type ?? 'text'}
                        className="input"
                        value={String(policyDraft[field.key] ?? '')}
                        readOnly={!canEdit}
                        onChange={(e) =>
                          setPolicyDraft((prev) => ({
                            ...prev,
                            [field.key]:
                              field.type === 'number' ? Number(e.target.value) : e.target.value,
                          }))
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                bonus_pct ở trên áp dụng khi bonus_mode ≠ none và đủ ngày công tối thiểu.
              </p>
            </section>
            {Array.isArray(policy.work_weekday_labels) ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Ngày làm việc: {(policy.work_weekday_labels as string[]).join(', ')}
              </p>
            ) : null}
            {canEdit ? (
              <button type="submit" className="btn btn-sm" disabled={savingPolicy}>
                Lưu chính sách
              </button>
            ) : null}
          </form>
        ) : null}
      </div>
    </CrmHrPageShell>
  );
}
