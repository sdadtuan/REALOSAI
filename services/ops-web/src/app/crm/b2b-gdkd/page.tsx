'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  HubPageLayout,
  StaffPageShell,
} from '@/components/layout';
import { fetchB2bOpsSummary, type B2bOpsSummary } from '@/lib/b2b-ops-summary-api';
import { fetchB2bRoutingAbReport, type B2bRoutingAbReport } from '@/lib/b2b-intelligence-api';
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

export default function B2bGdkdPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [projects, setProjects] = useState<B2bProjectListItem[]>([]);
  const [projectId, setProjectId] = useState('');
  const [summary, setSummary] = useState<B2bOpsSummary | null>(null);
  const [routingAb, setRoutingAb] = useState<B2bRoutingAbReport | null>(null);
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

  const reload = useCallback(async (access: string, pid?: string) => {
    setLoading(true);
    setError('');
    try {
      const [data, ab] = await Promise.all([
        fetchB2bOpsSummary(access, pid || undefined),
        fetchB2bRoutingAbReport(access, 30),
      ]);
      setSummary(data);
      setRoutingAb(ab);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải ops summary');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const list = await fetchB2bProjects(access);
        setProjects(list);
        const pid = list[0]?.id ?? '';
        setProjectId(pid);
        await reload(access, pid);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải dự án B2B');
      }
    })();
  }, [ensureAuth, reload]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  async function onApplyProject() {
    const access = await ensureAuth();
    if (!access) return;
    await reload(access, projectId);
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user}>
      <HubPageLayout
        title="GDKD Command Center"
        subtitle="Unmatched 24h · hop≥2 · SLA breach · CPaaS fail"
      >
        <div className="filter-bar">
          <label>
            Dự án
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Tất cả dự án</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => void onApplyProject()} disabled={loading}>
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>

        {error ? <p className="hub-error">{error}</p> : null}

        {summary ? (
          <div className="b2b-gdkd-summary" data-testid="b2b-gdkd-summary">
            <div className="b2b-speed-summary__cards">
              <div className="b2b-speed-card">
                <span className="b2b-speed-card__label">Unmatched 24h</span>
                <strong>{summary.unmatched_24h}</strong>
              </div>
              <div className="b2b-speed-card">
                <span className="b2b-speed-card__label">Hop ≥ 2</span>
                <strong>{summary.hop_ge_2}</strong>
              </div>
              <div className="b2b-speed-card">
                <span className="b2b-speed-card__label">SLA breach</span>
                <strong>{summary.sla_breach}</strong>
              </div>
              <div className="b2b-speed-card">
                <span className="b2b-speed-card__label">CPaaS fail 24h</span>
                <strong>{summary.cpaas_fail_24h}</strong>
              </div>
              {routingAb && routingAb.n > 0 ? (
                <>
                  <div className="b2b-speed-card">
                    <span className="b2b-speed-card__label">AI win rate 30d</span>
                    <strong>
                      {routingAb.ai_win_rate != null
                        ? `${Math.round(routingAb.ai_win_rate * 100)}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="b2b-speed-card">
                    <span className="b2b-speed-card__label">Hybrid win rate 30d</span>
                    <strong>
                      {routingAb.hybrid_win_rate != null
                        ? `${Math.round(routingAb.hybrid_win_rate * 100)}%`
                        : '—'}
                    </strong>
                  </div>
                </>
              ) : null}
            </div>
            <nav className="b2b-gdkd-links">
              <Link href="/crm/b2b-unmatched">Ingress chưa map</Link>
              <Link href="/crm/b2b-speed">Speed-to-lead</Link>
              <Link href="/crm/b2b-projects">Dự án PTT</Link>
            </nav>
          </div>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
