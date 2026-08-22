'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import { GpsPunchPanel } from '@/components/hr/GpsPunchPanel';
import { fetchMyPayslips, downloadMyPayslipXlsx, type PayslipRow } from '@/lib/hr-api';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { winPayslipPortalEnabled } from '@/lib/win/flags';

function formatVnd(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('vi-VN').format(v);
}

export default function PayslipMePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [error, setError] = useState('');

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
      setToken(access);
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
      setToken(access);
      return access;
    }
  }, [router]);

  useEffect(() => {
    void ensureAuth().then(async (access) => {
      if (!access || !winPayslipPortalEnabled()) return;
      try {
        const data = await fetchMyPayslips(access);
        setRows(data.payslips);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được payslip');
      }
    });
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!winPayslipPortalEnabled()) {
    return (
      <CrmHrPageShell user={user} onLogout={logout} title="Phiếu lương của tôi">
        <p className="muted">WIN-4-D payslip portal chưa bật (NEXT_PUBLIC_WIN_PAYSLIP_PORTAL).</p>
      </CrmHrPageShell>
    );
  }

  return (
    <CrmHrPageShell
      user={user}
      onLogout={logout}
      title="Phiếu lương của tôi"
      subtitle="Chỉ xem & tải Excel — read-only, không thay MISA"
    >
      {error ? <p className="form-error">{error}</p> : null}
      <p className="muted">
        Dữ liệu gắn hồ sơ CRM staff của bạn.{' '}
        <Link href="/crm/hr/my-wallet">Ví giấy tờ của tôi</Link>
        {' · '}
        <Link href="/crm/payroll">Bảng lương phòng HR</Link>.
      </p>
      {token ? <GpsPunchPanel token={token} /> : null}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Trạng thái</th>
              <th>Công thực tế</th>
              <th>Lương gross</th>
              <th>Khấu trừ</th>
              <th>Thực lĩnh</th>
              <th>Tải</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${row.year}-${row.month}-${row.payroll_id}`}>
                  <td>
                    {row.month}/{row.year}
                  </td>
                  <td>{String(row.payroll_status ?? '—')}</td>
                  <td>{row.workdays_actual ?? '—'}</td>
                  <td>{formatVnd(row.gross_pay)}</td>
                  <td>{formatVnd(row.total_deductions)}</td>
                  <td>{formatVnd(row.net_pay)}</td>
                  <td>
                    {token ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() =>
                          void downloadMyPayslipXlsx(token, Number(row.year), Number(row.month)).catch(
                            (err) => setError(err instanceof Error ? err.message : 'Tải thất bại'),
                          )
                        }
                      >
                        Excel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="muted">
                  Chưa có phiếu lương — kiểm tra kỳ đã tính lương trên HR payroll.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </CrmHrPageShell>
  );
}
