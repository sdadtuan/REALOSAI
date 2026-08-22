'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { LifecycleLaunchQaPanel } from '@/components/LifecycleLaunchQaPanel';
import { LifecycleFinancePanel } from '@/components/LifecycleFinancePanel';
import { LifecycleHubLinksPanel } from '@/components/LifecycleHubLinksPanel';
import { LifecycleSopPanel } from '@/components/LifecycleSopPanel';
import { LifecycleStaffPicker } from '@/components/LifecycleStaffPicker';
import { LifecycleTmmtPanel } from '@/components/LifecycleTmmtPanel';
import { MarketingAiPlannerPanel } from '@/components/mkt-ai/MarketingAiPlannerPanel';
import { ContentOsPanel } from '@/components/content-os/ContentOsPanel';
import { OpsServiceHubPanel } from '@/components/ops/OpsServiceHubPanel';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { DetailPageLayout } from '@/components/layout';
import { ServiceDeliveryWorkflowPanel } from '@/components/ServiceDeliveryWorkflowPanel';
import {
  fetchServiceLifecycleContext,
  fetchServiceLifecycleDetail,
  patchServiceLifecycle,
  staffMe,
  staffRefresh,
} from '@/lib/api';
import {
  canViewMktAiPlanner,
  canViewContentOs,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { isMktAiPlannerFeEnabled } from '@/lib/mkt-ai-planner-flags';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import { isOpsDvFeEnabled } from '@/lib/ops-dv-flags';
import { fetchResearchProjects } from '@/lib/market-research-api';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';
import { researchCtaHref, researchCtaReady, type ResearchProjectLookup } from '@/lib/research-cta';

const STAGES = ['lead', 'consult', 'proposal', 'onboard', 'deliver', 'handover', 'retain'];

export default function CrmServiceDeliveryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const lifecycleId = Number(params.id);
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [stage, setStage] = useState('lead');
  const [notes, setNotes] = useState('');
  const [backStage, setBackStage] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState<
    'workflow' | 'tmmt' | 'ai-planner' | 'content-os' | 'ops-hub' | 'finance' | 'sop' | 'launch_qa'
  >('workflow');
  const [researchProjectLookup, setResearchProjectLookup] =
    useState<ResearchProjectLookup>('pending');
  const [researchLookupError, setResearchLookupError] = useState('');

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
      if (!hasCap(me, 'crm_board', 'view')) {
        setError('Không có quyền');
        return null;
      }
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

  const reloadDetail = useCallback(async (access: string) => {
    const [data, ctx] = await Promise.all([
      fetchServiceLifecycleDetail(access, lifecycleId),
      fetchServiceLifecycleContext(access, lifecycleId).catch(() => null),
    ]);
    setRow(data);
    setContext(ctx);
    setStage(String(data.stage ?? 'lead'));
    setNotes(String(data.notes ?? ''));
  }, [lifecycleId]);

  useEffect(() => {
    if (!Number.isFinite(lifecycleId) || lifecycleId <= 0) {
      setError('ID không hợp lệ');
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      try {
        await reloadDetail(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, lifecycleId, reloadDetail]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (
      tab === 'workflow' ||
      tab === 'tmmt' ||
      tab === 'ai-planner' ||
      tab === 'content-os' ||
      tab === 'ops-hub' ||
      tab === 'finance' ||
      tab === 'sop' ||
      tab === 'launch_qa'
    ) {
      setDetailTab(tab);
    }
  }, [searchParams]);

  function switchTab(tab: typeof detailTab) {
    setDetailTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    if (tab !== 'ai-planner') {
      params.delete('step');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  async function onSaveNotes(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await patchServiceLifecycle(token, lifecycleId, { notes: notes.trim() });
      setMessage('Đã lưu ghi chú');
      await reloadDetail(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onBackwardStage() {
    if (!user || !token || !backStage) return;
    const idx = STAGES.indexOf(stage);
    const targetIdx = STAGES.indexOf(backStage);
    if (targetIdx >= idx) {
      setError('Chỉ lùi stage — chọn giai đoạn trước hiện tại');
      return;
    }
    if (!window.confirm(`Lùi stage ${stage} → ${backStage}?`)) return;
    setSaving(true);
    try {
      await patchServiceLifecycle(token, lifecycleId, { stage: backStage, notes: notes.trim() });
      setStage(backStage);
      setMessage(`Đã lùi → ${backStage}`);
      await reloadDetail(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lùi stage thất bại');
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const events = (row?.events as Array<{ id: number; to_stage: string; notes: string; created_at: string }>) ?? [];
  const showAiPlannerTab = isMktAiPlannerFeEnabled() && canViewMktAiPlanner(user);
  const showContentOsTab = isContentMarketingFeEnabled() && canViewContentOs(user);
  const showOpsHubTab = isOpsDvFeEnabled() && hasCap(user, 'crm_board', 'view');
  const showResearchCta =
    isMarketResearchFeEnabled() && hasCap(user, 'crm_research', 'view');
  const contract = context as { contract?: { agency_client_id?: string; title?: string } } | null;
  const researchClientId =
    String(contract?.contract?.agency_client_id ?? row?.agency_client_id ?? '').trim() || null;
  const researchTitle = String(contract?.contract?.title ?? '').trim();

  useEffect(() => {
    if (!token || !showResearchCta || String(row?.service_slug ?? '') !== 'phan-tich-thi-truong') {
      setResearchProjectLookup('pending');
      setResearchLookupError('');
      return;
    }
    setResearchProjectLookup('pending');
    setResearchLookupError('');
    void fetchResearchProjects(token, { lifecycle_id: lifecycleId })
      .then((out) => {
        const first = out.projects[0];
        setResearchProjectLookup(first?.id ?? 'none');
      })
      .catch(() => {
        setResearchProjectLookup('error');
        setResearchLookupError('Không tải được Research Project');
      });
  }, [token, showResearchCta, row?.service_slug, lifecycleId]);

  const researchHref = useMemo(() => {
    if (!showResearchCta || !researchCtaReady(researchProjectLookup)) return null;
    const href = researchCtaHref({
      slug: String(row?.service_slug ?? ''),
      lifecycleId,
      clientId: researchClientId,
      existingProjectId: typeof researchProjectLookup === 'number' ? researchProjectLookup : null,
    });
    if (!href || !researchTitle || !href.startsWith('/crm/research/new?')) return href;
    const q = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    q.set('title', researchTitle);
    return `/crm/research/new?${q.toString()}`;
  }, [
    showResearchCta,
    row?.service_slug,
    lifecycleId,
    researchClientId,
    researchProjectLookup,
    researchTitle,
  ]);

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Lifecycle" hideToolbar loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title={`Lifecycle #${lifecycleId}`}
      hideToolbar
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Triển khai DV', href: '/crm/service-delivery' },
        { label: `#${lifecycleId}` },
      ]}
    >
      <DetailPageLayout
        backHref="/crm/service-delivery"
        backLabel="← Service delivery"
        title={`#${lifecycleId} · ${String(row?.service_slug ?? '')}`}
        subtitle={row ? `Stage: ${stage} · Status: ${String(row.status ?? '')}` : undefined}
        actions={
          researchHref ? (
            <Link href={researchHref} className="btn btn-sm">
              Mở Research Project
            </Link>
          ) : null
        }
      >
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {researchLookupError ? <p className="error">{researchLookupError}</p> : null}
        {message ? <p style={{ color: 'var(--accent)' }}>{message}</p> : null}
        {row && !loading && token ? (
          <>
            <form onSubmit={(e) => void onSaveNotes(e)} style={{ display: 'grid', gap: '0.65rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span className="muted">Ghi chú</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  disabled={!hasCap(user, 'crm_board', 'edit') || saving}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.55rem 0.75rem',
                    color: 'var(--text)',
                  }}
                />
              </label>
              <button type="submit" className="btn btn-sm" disabled={saving || !hasCap(user, 'crm_board', 'edit')}>
                Lưu ghi chú
              </button>
            </form>
            {hasCap(user, 'crm_board', 'edit') ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'grid', gap: '0.3rem' }}>
                  <span className="muted">Lùi stage (chỉ backward)</span>
                  <select
                    value={backStage}
                    onChange={(e) => setBackStage(e.target.value)}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '0.45rem',
                      color: 'var(--text)',
                    }}
                  >
                    <option value="">— Chọn —</option>
                    {STAGES.filter((s) => STAGES.indexOf(s) < STAGES.indexOf(stage)).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-sm btn-secondary" disabled={!backStage || saving} onClick={() => void onBackwardStage()}>
                  Lùi stage
                </button>
              </div>
            ) : null}

          <LifecycleHubLinksPanel token={token} lifecycleId={lifecycleId} />

          <LifecycleStaffPicker
            token={token}
            user={user}
            lifecycleId={lifecycleId}
            assignedAm={row.assigned_am != null ? Number(row.assigned_am) : null}
            assignedSp={row.assigned_sp != null ? Number(row.assigned_sp) : null}
            context={context as { lead?: { owner_id?: number; owner_name?: string }; presales?: { assigned_sp?: number; assigned_sp_name?: string } }}
            onSaved={() => void reloadDetail(token)}
            onError={setError}
          />

          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={detailTab === 'workflow' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
              onClick={() => switchTab('workflow')}
            >
              Workflow
            </button>
            <button
              type="button"
              className={detailTab === 'tmmt' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
              onClick={() => switchTab('tmmt')}
            >
              TMMT chính thức
            </button>
            {showAiPlannerTab ? (
              <button
                type="button"
                className={detailTab === 'ai-planner' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                onClick={() => switchTab('ai-planner')}
              >
                AI Planner
              </button>
            ) : null}
            {showContentOsTab ? (
              <button
                type="button"
                className={detailTab === 'content-os' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                onClick={() => switchTab('content-os')}
              >
                Content Board
              </button>
            ) : null}
            {showOpsHubTab ? (
              <button
                type="button"
                className={detailTab === 'ops-hub' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                onClick={() => switchTab('ops-hub')}
              >
                Ops Hub
              </button>
            ) : null}
            <button
              type="button"
              className={detailTab === 'finance' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
              onClick={() => switchTab('finance')}
            >
              Tài chính
            </button>
            <button
              type="button"
              className={detailTab === 'sop' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
              onClick={() => switchTab('sop')}
            >
              SOP Launch
            </button>
            <button
              type="button"
              className={detailTab === 'launch_qa' ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
              onClick={() => switchTab('launch_qa')}
            >
              Launch QA
            </button>
          </div>

          {detailTab === 'workflow' ? (
            <ServiceDeliveryWorkflowPanel
              token={token}
              user={user}
              lifecycleId={lifecycleId}
              initialStage={stage}
              onStageChanged={setStage}
              onFinanceRefresh={() => void reloadDetail(token)}
              onOpenTmmtTab={() => switchTab('tmmt')}
              onOpenAiPlannerTab={showAiPlannerTab ? () => switchTab('ai-planner') : undefined}
              onOpenFinanceTab={() => switchTab('finance')}
              onOpenLaunchQaTab={() => switchTab('launch_qa')}
            />
          ) : detailTab === 'tmmt' ? (
            <LifecycleTmmtPanel
              token={token}
              user={user}
              lifecycleId={lifecycleId}
              stage={stage}
              onSaved={() => void reloadDetail(token)}
              onOpenAiPlannerTab={showAiPlannerTab ? () => switchTab('ai-planner') : undefined}
            />
          ) : detailTab === 'ai-planner' ? (
            <MarketingAiPlannerPanel
              token={token}
              user={user}
              lifecycleId={lifecycleId}
              stage={stage}
              serviceSlug={String(row.service_slug ?? '')}
              clientId={String(row.agency_client_id ?? '').trim() || undefined}
              onOpenTmmtTab={() => switchTab('tmmt')}
              onApplied={() => void reloadDetail(token)}
            />
          ) : detailTab === 'content-os' ? (
            <ContentOsPanel token={token} user={user} lifecycleId={lifecycleId} />
          ) : detailTab === 'ops-hub' && showOpsHubTab ? (
            <OpsServiceHubPanel token={token} lifecycleId={lifecycleId} user={user} />
          ) : detailTab === 'finance' ? (
            <LifecycleFinancePanel
              token={token}
              user={user}
              lifecycleId={lifecycleId}
              onSaved={() => void reloadDetail(token)}
            />
          ) : detailTab === 'sop' ? (
            <LifecycleSopPanel token={token} lifecycleId={lifecycleId} />
          ) : (
            <LifecycleLaunchQaPanel token={token} user={user} lifecycleId={lifecycleId} />
          )}

          {events.length > 0 ? (
            <div className="card" style={{ marginTop: '1rem', padding: '1rem' }}>
              <h3 style={{ fontSize: '1rem', marginTop: 0 }}>Events</h3>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {events.slice(-10).map((ev) => (
                  <li key={ev.id}>
                    → {ev.to_stage}: {ev.notes || '—'} ({ev.created_at})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
      </DetailPageLayout>
    </CrmDeliveryPageShell>
  );
}
