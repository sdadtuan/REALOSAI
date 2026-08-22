'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import {
  deleteCrmPipelineStage,
  fetchCrmSalesPipelineStages,
  patchCrmPipelineStage,
  saveCrmSalesPipelineStages,
  staffMe,
  staffRefresh,
  type CrmPipelineStageDef,
} from '@/lib/api';
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

type StageDraft = {
  stage_key: string;
  label: string;
  sort_order: number;
  sla_hours: number;
  owner_role: string;
  is_terminal: boolean;
  active: boolean;
};

function toDraft(stage: CrmPipelineStageDef): StageDraft {
  return {
    stage_key: stage.stage_key,
    label: stage.label,
    sort_order: stage.sort_order,
    sla_hours: stage.sla_hours,
    owner_role: stage.owner_role,
    is_terminal: stage.is_terminal,
    active: stage.active,
  };
}

export default function AdminCrmPipelinePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [stages, setStages] = useState<StageDraft[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');

  const preview = useMemo(
    () =>
      [...stages]
        .filter((s) => s.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => s.label),
    [stages],
  );

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

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
      if (!hasCap(me, 'crm_data_config', 'view')) {
        setError('Không có quyền CRM data config');
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

  const reload = useCallback(async (access: string) => {
    const data = await fetchCrmSalesPipelineStages(access, { include_inactive: true });
    setStages(data.stages.map(toDraft));
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải pipeline thất bại');
      }
    })();
  }, [ensureAuth, reload]);

  function updateStage(index: number, patch: Partial<StageDraft>) {
    setStages((prev) => prev.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)));
  }

  function moveStage(index: number, delta: number) {
    setStages((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next.map((stage, i) => ({ ...stage, sort_order: i }));
    });
  }

  function addStage() {
    setStages((prev) => [
      ...prev,
      {
        stage_key: `stage_${prev.length + 1}`,
        label: `Stage ${prev.length + 1}`,
        sort_order: prev.length,
        sla_hours: 24,
        owner_role: 'Sales',
        is_terminal: false,
        active: true,
      },
    ]);
  }

  async function handleSave() {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const out = await saveCrmSalesPipelineStages(
        access,
        stages.map((stage, index) => ({ ...stage, sort_order: index })),
      );
      setStages(out.stages.map(toDraft));
      setMsg('Đã lưu pipeline sales');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu pipeline thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handlePatchStage(index: number) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    const stage = stages[index];
    if (!stage) return;
    setBusy(true);
    setError('');
    try {
      await patchCrmPipelineStage(access, stage.stage_key, {
        label: stage.label,
        sort_order: stage.sort_order,
        sla_hours: stage.sla_hours,
        owner_role: stage.owner_role,
        is_terminal: stage.is_terminal,
        active: stage.active,
      });
      await reload(access);
      setMsg(`Đã cập nhật stage ${stage.stage_key}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật stage thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteStage(index: number) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    const stage = stages[index];
    if (!stage) return;
    if (!window.confirm(`Xóa stage ${stage.stage_key}?`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteCrmPipelineStage(access, stage.stage_key);
      await reload(access);
      setMsg('Đã xóa stage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa stage thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AdminPageShell user={null} onLogout={logout} section="crm-config" title="Pipeline sales" loading>
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Pipeline sales"
      subtitle="Stage funnel kinh doanh — SLA, owner role, thứ tự kéo (RNOS-35)"
    >
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        <div className="admin-pipeline-preview" aria-label="Preview funnel">
          {preview.map((label, i) => (
            <span key={`${label}-${i}`} className="admin-pipeline-preview__chip">
              {label}
              {i < preview.length - 1 ? <span aria-hidden>→</span> : null}
            </span>
          ))}
        </div>

        <div className="admin-pipeline-list">
          {stages.map((stage, index) => (
            <div key={`${stage.stage_key}-${index}`} className="admin-pipeline-row card" style={{ padding: '0.75rem' }}>
              <div className="admin-pipeline-row__head">
                <strong>
                  #{index + 1} · {stage.stage_key}
                  {!stage.active ? ' (ẩn)' : ''}
                </strong>
                {canConfigure ? (
                  <div className="admin-pipeline-row__actions">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => moveStage(index, -1)}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => moveStage(index, 1)}>
                      ↓
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="admin-crm-form__grid">
                <input
                  className="kpi-input"
                  value={stage.stage_key}
                  disabled={!canConfigure}
                  onChange={(e) => updateStage(index, { stage_key: e.target.value })}
                  aria-label="Stage key"
                />
                <input
                  className="kpi-input"
                  value={stage.label}
                  disabled={!canConfigure}
                  onChange={(e) => updateStage(index, { label: e.target.value })}
                  aria-label="Label"
                />
                <input
                  className="kpi-input"
                  type="number"
                  min={0}
                  value={stage.sla_hours}
                  disabled={!canConfigure}
                  onChange={(e) => updateStage(index, { sla_hours: Number(e.target.value) })}
                  aria-label="SLA hours"
                />
                <input
                  className="kpi-input"
                  value={stage.owner_role}
                  disabled={!canConfigure}
                  onChange={(e) => updateStage(index, { owner_role: e.target.value })}
                  aria-label="Owner role"
                />
                <label className="admin-crm-checkbox">
                  <input
                    type="checkbox"
                    checked={stage.is_terminal}
                    disabled={!canConfigure}
                    onChange={(e) => updateStage(index, { is_terminal: e.target.checked })}
                  />
                  Terminal
                </label>
                <label className="admin-crm-checkbox">
                  <input
                    type="checkbox"
                    checked={stage.active}
                    disabled={!canConfigure}
                    onChange={(e) => updateStage(index, { active: e.target.checked })}
                  />
                  Active
                </label>
              </div>
              {canConfigure ? (
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => void handlePatchStage(index)}>
                    Lưu stage
                  </button>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => void handleDeleteStage(index)}>
                    Xóa
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {canConfigure ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={addStage}>
              + Stage
            </button>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void handleSave()}>
              {busy ? 'Đang lưu…' : 'Lưu toàn bộ pipeline'}
            </button>
          </div>
        ) : (
          <p className="muted">Chế độ chỉ xem — cần quyền configure để sửa.</p>
        )}
      </div>
    </AdminPageShell>
  );
}
