'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import {
  createVdAdminModel,
  createVdAdminProvider,
  listVdAdminModels,
  listVdAdminProviders,
  vdModelKey,
  vdModelVerifiedAt,
  type VdModelRow,
  type VdProviderRow,
} from '@/lib/video-sop-api';

function canViewVdProviders(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_vd.admin', 'view') ||
    hasCap(user, 'crm_vd.admin', 'create') ||
    hasCap(user, 'ai_admin', 'view')
  );
}

function canCreateVdProviders(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'crm_vd.admin', 'create') || hasCap(user, 'ai_admin', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function capabilityText(value: VdModelRow['capability_json']): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

export default function AdminVideoProvidersPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewVdProviders);
  const canCreate = canCreateVdProviders(user);
  const [providers, setProviders] = useState<VdProviderRow[]>([]);
  const [models, setModels] = useState<VdModelRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [providerCode, setProviderCode] = useState('');
  const [providerLabel, setProviderLabel] = useState('');
  const [modelProviderCode, setModelProviderCode] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [capabilityJson, setCapabilityJson] = useState('{"kind":"media"}');

  const reload = useCallback(async () => {
    if (!token || !isVideoSopEnabled()) return;
    setLoadError('');
    try {
      const [providerRows, modelRows] = await Promise.all([
        listVdAdminProviders(token),
        listVdAdminModels(token),
      ]);
      setProviders(providerRows);
      setModels(modelRows);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải providers thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function runCreateProvider() {
    if (!token || !providerCode.trim() || !providerLabel.trim()) return;
    setBusy(true);
    setLoadError('');
    try {
      await createVdAdminProvider(token, {
        code: providerCode.trim(),
        label: providerLabel.trim(),
      });
      setProviderCode('');
      setProviderLabel('');
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tạo provider thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runCreateModel() {
    if (!token || !modelProviderCode.trim() || !modelCode.trim()) return;
    setBusy(true);
    setLoadError('');
    let capability: Record<string, unknown> | string = capabilityJson;
    const trimmed = capabilityJson.trim();
    if (trimmed) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          capability = parsed as Record<string, unknown>;
        }
      } catch {
        setLoadError('capability_json không hợp lệ');
        setBusy(false);
        return;
      }
    } else {
      capability = {};
    }
    try {
      await createVdAdminModel(token, {
        provider_code: modelProviderCode.trim(),
        code: modelCode.trim(),
        capability_json: capability,
      });
      setModelProviderCode('');
      setModelCode('');
      setCapabilityJson('{"kind":"media"}');
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tạo model thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="ai-automation"
      title="Video SOP — Providers"
      breadcrumb={[{ label: 'Quản trị', href: '/admin' }, { label: 'Video SOP — Providers' }]}
      loading={loading}
    >
      <div className="admin-governance-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}

        {!isVideoSopEnabled() ? (
          <p>Module tắt</p>
        ) : (
          <>
            <h2>Providers</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>code</th>
                  <th>label</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((row) => (
                  <tr key={row.id ?? row.code}>
                    <td>{row.code}</td>
                    <td>{row.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {providers.length === 0 ? <p className="muted">Chưa có provider — seed ffmpeg từ DDL S2</p> : null}

            {canCreate ? (
              <div className="kpi-page__filters">
                <input
                  type="text"
                  className="kpi-input"
                  placeholder="code"
                  value={providerCode}
                  onChange={(e) => setProviderCode(e.target.value)}
                  disabled={busy}
                />
                <input
                  type="text"
                  className="kpi-input"
                  placeholder="label"
                  value={providerLabel}
                  onChange={(e) => setProviderLabel(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !providerCode.trim() || !providerLabel.trim()}
                  onClick={() => void runCreateProvider()}
                >
                  Thêm provider
                </button>
              </div>
            ) : null}

            <h2>Models</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>provider</th>
                  <th>code</th>
                  <th>model_key</th>
                  <th>verified_at</th>
                  <th>capability_json</th>
                </tr>
              </thead>
              <tbody>
                {models.map((row) => (
                  <tr key={row.id ?? `${row.provider}:${row.code}`}>
                    <td>{row.provider}</td>
                    <td>{row.code}</td>
                    <td>{vdModelKey(row)}</td>
                    <td>{vdModelVerifiedAt(row.capability_json)}</td>
                    <td className="muted">{capabilityText(row.capability_json)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {canCreate ? (
              <div className="kpi-page__filters">
                <input
                  type="text"
                  className="kpi-input"
                  placeholder="provider_code"
                  value={modelProviderCode}
                  onChange={(e) => setModelProviderCode(e.target.value)}
                  disabled={busy}
                />
                <input
                  type="text"
                  className="kpi-input"
                  placeholder="code"
                  value={modelCode}
                  onChange={(e) => setModelCode(e.target.value)}
                  disabled={busy}
                />
                <textarea
                  className="kpi-input"
                  placeholder="capability_json"
                  value={capabilityJson}
                  onChange={(e) => setCapabilityJson(e.target.value)}
                  disabled={busy}
                  rows={3}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !modelProviderCode.trim() || !modelCode.trim()}
                  onClick={() => void runCreateModel()}
                >
                  Thêm model
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AdminPageShell>
  );
}
