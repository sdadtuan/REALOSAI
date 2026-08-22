'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { InsightsRagSearch } from '@/components/research/InsightsRagSearch';
import { ResearchRagReembedPanel } from '@/components/research/ResearchRagReembedPanel';
import { ResearchStatusChip } from '@/components/research/ResearchStatusChip';
import { ResearchThemeQuarterTable } from '@/components/research/ResearchThemeQuarterTable';
import { staffMe, staffRefresh } from '@/lib/api';
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
import {
  fetchResearchHealth,
  fetchResearchOpsAnalytics,
  fetchResearchThemeQuarterAnalytics,
  type OpsAnalyticsPayload,
  type ThemeQuarterAnalyticsPayload,
} from '@/lib/market-research-api';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';

const THEME_ANALYTICS_BANNER =
  'Chỉ insight đã duyệt bản khách / published. Đếm theo theme gắn trên insight, bucket theo quý (updated_at). Δ QoQ / YoY khi có số liệu quý trước.';

export default function CrmResearchAnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [data, setData] = useState<OpsAnalyticsPayload | null>(null);
  const [themeData, setThemeData] = useState<ThemeQuarterAnalyticsPayload | null>(null);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragOpenaiEmbedEnabled, setRagOpenaiEmbedEnabled] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [selectedThemeCode, setSelectedThemeCode] = useState('');
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const yearOptions = useMemo(() => {
    const current = new Date().getUTCFullYear();
    return [current, current - 1, current - 2];
  }, []);

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
      if (!hasCap(me, 'crm_research', 'view')) {
        setError('Không có quyền xem nghiên cứu thị trường');
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

  const loadAnalytics = useCallback(
    async (access: string, selectedYear: number) => {
      setLoading(true);
      setError('');
      try {
        const [ops, themes, health] = await Promise.all([
          fetchResearchOpsAnalytics(access),
          fetchResearchThemeQuarterAnalytics(access, { year: selectedYear }),
          fetchResearchHealth(access).catch(() => ({
            rag_enabled: false,
            rag_openai_embed_enabled: false,
          })),
        ]);
        setData(ops);
        setThemeData(themes);
        setRagEnabled(health.rag_enabled === true);
        setRagOpenaiEmbedEnabled(health.rag_openai_embed_enabled === true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải phân tích thất bại');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      if (!isMarketResearchFeEnabled()) {
        setUser(getStoredUser());
        return;
      }
      const access = await ensureAuth();
      if (!access) return;
      setAccessToken(access);
      await loadAnalytics(access, year);
    })();
  }, [ensureAuth, loadAnalytics, year]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!isMarketResearchFeEnabled()) {
    const body = (
      <div className="page-card">
        <p>Module nghiên cứu thị trường chưa bật.</p>
      </div>
    );
    if (!user) return body;
    return (
      <StaffPageShell user={user} onLogout={logout}>
        {body}
      </StaffPageShell>
    );
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  const p50 = data?.cycle_time_hours.designed_to_approved_p50;
  const cards = [
    {
      label: 'Thời gian chu kỳ (p50 giờ)',
      value: p50 == null ? '—' : String(p50),
    },
    {
      label: '% project có evidence đã verify',
      value: data ? `${data.evidence_completeness.with_verified_pct}` : '—',
    },
    {
      label: 'Project đã giao',
      value: data ? String(data.activation.distributed_projects) : '—',
    },
  ];

  const canConfigure = hasCap(user, 'crm_research', 'configure');
  const showReembedPanel = ragOpenaiEmbedEnabled && canConfigure;

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { href: '/crm/research', label: 'Nghiên cứu thị trường' },
        { href: '/crm/research/analytics', label: 'Phân tích nghiên cứu' },
      ]}
    >
      <div className="page-card stack-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Phân tích nghiên cứu</h1>
          <Link href="/crm/research" className="btn btn-sm btn-secondary">
            Nghiên cứu thị trường
          </Link>
        </div>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="agency-stat-grid channel-hub-summary">
          {cards.map((card) => (
            <div key={card.label} className="agency-stat-card">
              <strong>{card.value}</strong>
              <span className="muted">{card.label}</span>
            </div>
          ))}
        </div>
        {data?.projects.length ? (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Trạng thái</th>
                <th>Evidence đã verify</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/crm/research/${p.id}?tab=brief`} className="nav-link">
                      {p.id}
                    </Link>
                  </td>
                  <td>{p.client_id}</td>
                  <td>
                    <ResearchStatusChip status={p.status} />
                  </td>
                  <td>{p.verified_ev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {data && data.projects.length === 0 && !loading ? (
          <p className="muted">Chưa có dự án nghiên cứu</p>
        ) : null}

        {showReembedPanel && accessToken ? (
          <ResearchRagReembedPanel token={accessToken} />
        ) : null}

        <section className="stack-gap" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Theme theo quý</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
              Năm
              <select
                className="kpi-input"
                value={year}
                disabled={loading}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            {THEME_ANALYTICS_BANNER}
          </p>
          {themeData ? (
            <ResearchThemeQuarterTable
              rows={themeData.rows}
              year={themeData.year}
              selectedThemeCode={selectedThemeCode}
              onThemeClick={setSelectedThemeCode}
            />
          ) : null}
          <InsightsRagSearch
            ragEnabled={ragEnabled}
            prefillThemeCode={selectedThemeCode || undefined}
          />
        </section>
      </div>
    </StaffPageShell>
  );
}
