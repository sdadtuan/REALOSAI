'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { API_BASE, staffMe, staffRefresh } from '@/lib/api';
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
  canEditVdBudget,
  VIDEO_SOP_API,
  type VdCostsView,
  type VdProjectRow,
} from '@/lib/video-sop-api';

const S7_BANNER = 'S7 — Cost ledger SC-11. BR-06 reserve trước enqueue. Export kế toán khi đóng project.';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function isProjectClosed(project: VdProjectRow | null): boolean {
  if (!project) return false;
  return project.status === 'cancelled' || project.stage === 'archived';
}

export default function CrmVideoSopCostPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [project, setProject] = useState<VdProjectRow | null>(null);
  const [costs, setCosts] = useState<VdCostsView | null>(null);
  const [limitAmount, setLimitAmount] = useState('');
  const [bufferFactor, setBufferFactor] = useState('');
  const [overshootFactor, setOvershootFactor] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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
      if (!canViewVideoSop(me)) {
        setError('Không có quyền Video SOP');
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
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        access = out.access_token;
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
        if (!canViewVideoSop(me)) {
          setError('Không có quyền Video SOP');
          return null;
        }
        return access;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    }
  }, [router]);

  const loadData = useCallback(
    async (access: string) => {
      const [proj, costView] = await Promise.all([
        VIDEO_SOP_API.getProject(access, projectId),
        VIDEO_SOP_API.listCosts(access, projectId),
      ]);
      setProject(proj);
      setCosts(costView);
      setLimitAmount(String(costView.budget.limit_amount));
      setBufferFactor(String(costView.budget.buffer_factor));
      setOvershootFactor(String(costView.budget.overshoot_factor));
    },
    [projectId],
  );

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      const access = await ensureAuth();
      if (!access || !isVideoSopEnabled()) return;
      setLoading(true);
      setError('');
      try {
        await loadData(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải cost ledger thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadData, projectId]);

  async function saveBudget() {
    const access = await ensureAuth();
    if (!access || !canEditVdBudget(user)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await VIDEO_SOP_API.saveBudget(access, projectId, {
        limit_amount: Number(limitAmount),
        buffer_factor: Number(bufferFactor),
        overshoot_factor: Number(overshootFactor),
      });
      setMessage('Đã lưu budget');
      await loadData(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu budget thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function exportAccounting() {
    const access = await ensureAuth();
    if (!access) return;
    if (!isProjectClosed(project)) {
      setError('Export kế toán cần project cancelled hoặc stage archived');
      return;
    }
    setError('');
    try {
      const blob = await VIDEO_SOP_API.exportCostsXlsx(access, projectId, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vd-costs-${projectId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export thất bại');
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Cost Ledger (SC-11)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Cost Ledger (SC-11)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const budget = costs?.budget;
  const canEdit = canEditVdBudget(user);

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Cost Ledger (SC-11)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: 'Cost (SC-11)' },
      ]}
    >
      <div className="page-card stack-gap">
        <p
          style={{
            margin: 0,
            padding: '0.75rem 1rem',
            border: '1px solid var(--border, #d0d5dd)',
            background: 'rgba(15, 23, 42, 0.04)',
          }}
        >
          {S7_BANNER}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/crm/video/${projectId}`} className="nav-link">
            ← Video #{projectId}
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}

        {budget ? (
          <section>
            <h3 style={{ marginTop: 0 }}>Budget</h3>
            <dl style={{ margin: '0 0 1rem', display: 'grid', gap: '0.35rem' }}>
              <div>
                <dt className="muted">estimated_total</dt>
                <dd style={{ margin: 0 }}>{budget.estimated_total}</dd>
              </div>
              <div>
                <dt className="muted">actual_total</dt>
                <dd style={{ margin: 0 }}>{budget.actual_total}</dd>
              </div>
              <div>
                <dt className="muted">currency</dt>
                <dd style={{ margin: 0 }}>{budget.currency}</dd>
              </div>
              <div>
                <dt className="muted">warnings</dt>
                <dd style={{ margin: 0 }}>
                  {budget.warnings.warn70 ? 'warn70 ' : ''}
                  {budget.warnings.warn90 ? 'warn90 ' : ''}
                  {budget.warnings.warn100 ? 'warn100' : ''}
                  {!budget.warnings.warn70 && !budget.warnings.warn90 && !budget.warnings.warn100
                    ? '—'
                    : null}
                </dd>
              </div>
            </dl>
            {canEdit ? (
              <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 320 }}>
                <label>
                  limit_amount
                  <input
                    type="number"
                    value={limitAmount}
                    onChange={(e) => setLimitAmount(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </label>
                <label>
                  buffer_factor
                  <input
                    type="number"
                    step="0.1"
                    value={bufferFactor}
                    onChange={(e) => setBufferFactor(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </label>
                <label>
                  overshoot_factor
                  <input
                    type="number"
                    step="0.1"
                    value={overshootFactor}
                    onChange={(e) => setOvershootFactor(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => void saveBudget()}
                >
                  Lưu budget
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <h3>Ledger</h3>
          {!costs?.items.length ? <p className="muted">Chưa có dòng cost — enqueue job có reserve.</p> : null}
          {costs && costs.items.length > 0 ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>id</th>
                    <th>kind</th>
                    <th>vendor</th>
                    <th>amount</th>
                    <th>created_at</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.kind}</td>
                      <td>{row.vendor || '—'}</td>
                      <td>{row.amount}</td>
                      <td>{row.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section>
          <h3>Export kế toán</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Chỉ khi status=cancelled hoặc stage=archived (`?close=1`).
          </p>
          <p style={{ margin: '0.25rem 0' }}>
            Project: status={project?.status ?? '—'} · stage={project?.stage ?? '—'}
          </p>
          <button
            type="button"
            className="btn"
            disabled={!isProjectClosed(project)}
            onClick={() => void exportAccounting()}
          >
            Tải export.xlsx
          </button>
        </section>
      </div>
    </CrmDeliveryPageShell>
  );
}
