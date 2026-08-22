'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import {
  createChangeRequest,
  fetchStaffJobFunctions,
  fetchStaffPermissionPosition,
  fetchStaffPermissionPositions,
  fetchStaffPermissionSets,
  simulateMatrixImpact,
  simulateStaffPermissions,
  staffMe,
  staffRefresh,
  type AdminPolicyCapPatch,
  type MatrixImpactResult,
  type StaffPermissionSimulateMenuItem,
  type StaffPermissionSimulateResponse,
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
import { winSimulatorEnabled } from '@/lib/win/flags';

type SimulatorTab = 'preview' | 'whatif';

function capsFromGrants(grants: Record<string, string[]>): AdminPolicyCapPatch[] {
  const out: AdminPolicyCapPatch[] = [];
  for (const [section, actions] of Object.entries(grants)) {
    for (const action of actions) {
      out.push({ section, action });
    }
  }
  return out;
}

function capKey(cap: AdminPolicyCapPatch): string {
  return `${cap.section}.${cap.action}`;
}

export default function AdminPermissionsSimulatorPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [tab, setTab] = useState<SimulatorTab>('preview');
  const [positions, setPositions] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [jobFunctions, setJobFunctions] = useState<Array<{ code: string; name: string }>>([]);
  const [sets, setSets] = useState<Array<{ code: string; name: string }>>([]);
  const [positionId, setPositionId] = useState<number | null>(null);
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [compareUserId, setCompareUserId] = useState('');
  const [result, setResult] = useState<StaffPermissionSimulateResponse | null>(null);
  const [positionCaps, setPositionCaps] = useState<AdminPolicyCapPatch[]>([]);
  const [patchAdded, setPatchAdded] = useState<AdminPolicyCapPatch[]>([]);
  const [patchRemoved, setPatchRemoved] = useState<AdminPolicyCapPatch[]>([]);
  const [impact, setImpact] = useState<MatrixImpactResult | null>(null);
  const [changeRequestId, setChangeRequestId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    if (!winSimulatorEnabled()) {
      setError('Simulator chưa bật (NEXT_PUBLIC_WIN_SIMULATOR=1)');
      return null;
    }
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
      if (!hasCap(me, 'crm_data_config', 'configure')) {
        setError('Cần quyền crm_data_config.configure');
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

  const loadPositionCaps = useCallback(async (access: string, pid: number) => {
    const detail = await fetchStaffPermissionPosition(access, pid);
    setPositionCaps(capsFromGrants(detail.grants));
    setPatchAdded([]);
    setPatchRemoved([]);
    setImpact(null);
    setChangeRequestId(null);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const [posRows, fnRows, setRows] = await Promise.all([
          fetchStaffPermissionPositions(access),
          fetchStaffJobFunctions(access),
          fetchStaffPermissionSets(access),
        ]);
        setPositions(posRows);
        setJobFunctions(fnRows.map((r) => ({ code: r.code, name: r.label })));
        setSets(setRows.map((r) => ({ code: r.code, name: r.name })));
        if (posRows.length) {
          setPositionId(posRows[0].id);
          await loadPositionCaps(access, posRows[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải catalog thất bại');
      }
    })();
  }, [ensureAuth, loadPositionCaps]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access || positionId == null) return;
    void loadPositionCaps(access, positionId);
  }, [positionId, loadPositionCaps]);

  async function runSimulate() {
    const access = getAccessToken();
    if (!access || positionId == null) return;
    setBusy(true);
    setError('');
    try {
      const out = await simulateStaffPermissions(access, {
        position_id: positionId,
        job_functions: selectedFunctions,
        set_codes: selectedSets,
        compare_user_id: compareUserId.trim() || undefined,
      });
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulate thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runImpact() {
    const access = getAccessToken();
    if (!access || positionId == null) return;
    if (patchAdded.length === 0 && patchRemoved.length === 0) {
      setError('Chọn ít nhất một cap thêm hoặc bớt');
      return;
    }
    setBusy(true);
    setError('');
    setChangeRequestId(null);
    try {
      const out = await simulateMatrixImpact(access, {
        position_id: positionId,
        patch: {
          added: patchAdded.length ? patchAdded : undefined,
          removed: patchRemoved.length ? patchRemoved : undefined,
        },
      });
      setImpact(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tính impact thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function runCreateChangeRequest() {
    const access = getAccessToken();
    if (!access || positionId == null) return;
    const position = positions.find((p) => p.id === positionId);
    setBusy(true);
    setError('');
    try {
      const out = await createChangeRequest(access, {
        kind: 'permission_matrix',
        entity_key: position?.code ?? String(positionId),
        patch_json: {
          position_id: positionId,
          added: patchAdded,
          removed: patchRemoved,
        },
        impact_json: impact ? (impact as unknown as Record<string, unknown>) : undefined,
      });
      setChangeRequestId(out.request.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo change request thất bại');
    } finally {
      setBusy(false);
    }
  }

  const visibleMenu = useMemo(
    () => (result?.menu ?? []).filter((m: StaffPermissionSimulateMenuItem) => m.visible),
    [result],
  );
  const hiddenMenu = useMemo(
    () => (result?.menu ?? []).filter((m: StaffPermissionSimulateMenuItem) => !m.visible),
    [result],
  );

  const removedKeys = useMemo(() => new Set(patchRemoved.map(capKey)), [patchRemoved]);

  function toggleFunction(code: string) {
    setSelectedFunctions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function toggleSet(code: string) {
    setSelectedSets((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function toggleRemoveCap(cap: AdminPolicyCapPatch) {
    const key = capKey(cap);
    if (removedKeys.has(key)) {
      setPatchRemoved((prev) => prev.filter((c) => capKey(c) !== key));
    } else {
      setPatchRemoved((prev) => [...prev, cap]);
      setPatchAdded((prev) => prev.filter((c) => capKey(c) !== key));
    }
  }

  if (!user) {
    return (
      <AdminPageShell user={null} onLogout={logout} section="crm-config" title="Simulator" loading>
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Permission Simulator"
      subtitle="Preview menu ops-web theo position + job function + permission sets (VUX-04)"
    >
      <div className="page-card stack-gap" data-testid="permissions-simulator-page">
        <AdminPermissionsSubNav />
        {error ? <p className="error">{error}</p> : null}

        <div className="win-filter-chips">
          <button
            type="button"
            className={`win-filter-chip${tab === 'preview' ? ' win-filter-chip--active' : ''}`}
            onClick={() => setTab('preview')}
          >
            Preview menu
          </button>
          <button
            type="button"
            className={`win-filter-chip${tab === 'whatif' ? ' win-filter-chip--active' : ''}`}
            onClick={() => setTab('whatif')}
          >
            What-if ma trận
          </button>
        </div>

        {tab === 'preview' ? (
          <>
            <div className="kpi-page__filters">
              <label className="muted">
                Chức vụ
                <select
                  value={positionId ?? ''}
                  onChange={(e) => setPositionId(Number(e.target.value))}
                  disabled={busy}
                >
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="muted">
                So sánh user (UUID, tuỳ chọn)
                <input
                  type="text"
                  value={compareUserId}
                  onChange={(e) => setCompareUserId(e.target.value)}
                  className="kpi-input"
                  placeholder="00000000-0000-4000-8000-…"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || positionId == null}
                onClick={() => void runSimulate()}
              >
                Chạy simulate
              </button>
            </div>

            <section className="stack-gap">
              <h3 className="section-title">Job functions</h3>
              <div className="win-filter-chips">
                {jobFunctions.map((fn) => (
                  <button
                    key={fn.code}
                    type="button"
                    className={`win-filter-chip${selectedFunctions.includes(fn.code) ? ' win-filter-chip--active' : ''}`}
                    onClick={() => toggleFunction(fn.code)}
                  >
                    {fn.code}
                  </button>
                ))}
              </div>
            </section>

            <section className="stack-gap">
              <h3 className="section-title">Permission sets</h3>
              <div className="win-filter-chips">
                {sets.map((set) => (
                  <button
                    key={set.code}
                    type="button"
                    className={`win-filter-chip${selectedSets.includes(set.code) ? ' win-filter-chip--active' : ''}`}
                    onClick={() => toggleSet(set.code)}
                  >
                    {set.code}
                  </button>
                ))}
              </div>
            </section>

            {result ? (
              <>
                <section className="stack-gap">
                  <h3 className="section-title">Menu hiển thị ({visibleMenu.length})</h3>
                  <ul className="simulator-menu-list">
                    {visibleMenu.map((item) => (
                      <li key={item.href}>
                        <strong>{item.label}</strong>
                        <span className="muted"> {item.href}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="stack-gap">
                  <h3 className="section-title">Menu ẩn ({hiddenMenu.length})</h3>
                  <ul className="simulator-menu-list simulator-menu-list--hidden">
                    {hiddenMenu.map((item) => (
                      <li key={item.href}>
                        {item.label} <span className="muted">{item.href}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                {result.diff.added.length > 0 || result.diff.removed.length > 0 ? (
                  <section className="stack-gap">
                    <h3 className="section-title">Diff so với user</h3>
                    {result.diff.added.length ? (
                      <p className="muted">+ {result.diff.added.join(', ')}</p>
                    ) : null}
                    {result.diff.removed.length ? (
                      <p className="muted">− {result.diff.removed.join(', ')}</p>
                    ) : null}
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            <div className="kpi-page__filters">
              <label className="muted">
                Chức vụ
                <select
                  value={positionId ?? ''}
                  onChange={(e) => setPositionId(Number(e.target.value))}
                  disabled={busy}
                >
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn btn-primary" disabled={busy || positionId == null} onClick={() => void runImpact()}>
                Tính impact
              </button>
            </div>

            <section className="stack-gap">
              <h3 className="section-title">Caps ma trận — bấm để bớt (−)</h3>
              <div className="win-filter-chips">
                {positionCaps.map((cap) => {
                  const key = capKey(cap);
                  const removed = removedKeys.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`win-filter-chip${removed ? ' win-filter-chip--active' : ''}`}
                      onClick={() => toggleRemoveCap(cap)}
                    >
                      {removed ? '− ' : ''}
                      {key}
                    </button>
                  );
                })}
              </div>
            </section>

            {(patchAdded.length > 0 || patchRemoved.length > 0) && (
              <section className="stack-gap">
                <h3 className="section-title">Patch what-if</h3>
                {patchRemoved.length ? (
                  <p className="muted">Bớt: {patchRemoved.map(capKey).join(', ')}</p>
                ) : null}
                {patchAdded.length ? <p className="muted">Thêm: {patchAdded.map(capKey).join(', ')}</p> : null}
              </section>
            )}

            {impact ? (
              <section className="stack-gap">
                <h3 className="section-title">
                  {impact.affected_user_count} user bị ảnh hưởng ({impact.elapsed_ms}ms)
                </h3>
                <p className="muted">
                  PII loss: {impact.aggregate.users_with_pii_loss} · caps bớt:{' '}
                  {impact.aggregate.caps_removed_unique.join(', ') || '—'}
                </p>
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Caps bớt</th>
                      <th>Menu mất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impact.sample_users.map((row) => (
                      <tr key={row.user_id}>
                        <td>
                          <Link href={`/admin/crm/org/users?highlight=${row.user_id}`}>{row.display_name}</Link>
                          <div className="muted">{row.email}</div>
                        </td>
                        <td className="muted">{row.caps_removed.join(', ') || '—'}</td>
                        <td className="muted">{row.menu_items_lost.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="kpi-page__filters">
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void runCreateChangeRequest()}>
                    Tạo change request →
                  </button>
                  {changeRequestId ? (
                    <Link href="/admin/policies/approvals" className="btn btn-ghost">
                      Xem hàng đợi duyệt
                    </Link>
                  ) : null}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AdminPageShell>
  );
}
