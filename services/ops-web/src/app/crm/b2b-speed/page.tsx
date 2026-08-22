'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FilterBar,
  FilterBarActions,
  HubPageLayout,
  StaffPageShell,
} from '@/components/layout';
import { fetchB2bSpeedReport, type B2bSpeedReport } from '@/lib/b2b-speed-api';
import { fetchB2bProjects, type B2bProjectListItem } from '@/lib/b2b-projects-api';
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
import { staffMe, staffRefresh } from '@/lib/api';

function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export default function B2bSpeedPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [projects, setProjects] = useState<B2bProjectListItem[]>([]);
  const [projectId, setProjectId] = useState('');
  const [days, setDays] = useState(7);
  const [report, setReport] = useState<B2bSpeedReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (!hasCap(me, 'crm_b2b_projects', 'view')) {
        setError('Cần quyền crm_b2b_projects.view');
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

  const reload = useCallback(
    async (access: string, pid: string, windowDays: number) => {
      if (!pid) {
        setReport(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await fetchB2bSpeedReport(access, { projectId: pid, days: windowDays });
        setReport(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải được speed report');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const list = await fetchB2bProjects(access);
        setProjects(list);
        if (list[0]?.id) {
          setProjectId(list[0].id);
          await reload(access, list[0].id, days);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải dự án B2B');
      }
    })();
  }, [ensureAuth, reload, days]);

  async function onApplyFilters() {
    const access = await ensureAuth();
    if (!access) return;
    await reload(access, projectId, days);
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user}>
      <HubPageLayout title="Speed-to-lead" subtitle="p50/p95 thời gian phản hồi lead (giờ làm việc)">
        <FilterBar>
          <label>
            Dự án
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— chọn dự án —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cửa sổ (ngày)
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={30}>30</option>
            </select>
          </label>
          <FilterBarActions>
            <button type="button" onClick={() => void onApplyFilters()} disabled={loading || !projectId}>
              {loading ? 'Đang tải…' : 'Áp dụng'}
            </button>
          </FilterBarActions>
        </FilterBar>

        {error ? <p className="hub-error">{error}</p> : null}

        {report ? (
          <div className="b2b-speed-summary" data-testid="b2b-speed-summary">
            <div className="b2b-speed-summary__cards">
              <div className="b2b-speed-card">
                <span className="b2b-speed-card__label">p50</span>
                <strong>{formatSeconds(report.p50_seconds)}</strong>
              </div>
              <div className="b2b-speed-card">
                <span className="b2b-speed-card__label">p95</span>
                <strong>{formatSeconds(report.p95_seconds)}</strong>
              </div>
              <div className="b2b-speed-card">
                <span className="b2b-speed-card__label">Hot p95</span>
                <strong>{formatSeconds(report.hot_p95_seconds)}</strong>
              </div>
              <div className="b2b-speed-card">
                <span className="b2b-speed-card__label">n</span>
                <strong>{report.n}</strong>
              </div>
            </div>

            {report.by_staff.length ? (
              <table className="hub-table">
                <thead>
                  <tr>
                    <th>Staff ID</th>
                    <th>n</th>
                    <th>p50</th>
                  </tr>
                </thead>
                <tbody>
                  {report.by_staff.map((row) => (
                    <tr key={row.staff_id}>
                      <td>{row.staff_id}</td>
                      <td>{row.n}</td>
                      <td>{formatSeconds(row.p50_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>Chưa có mẫu trong cửa sổ đã chọn.</p>
            )}
          </div>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
