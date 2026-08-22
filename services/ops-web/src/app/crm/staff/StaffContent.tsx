'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminControlPlaneLayout } from '@/components/admin/AdminLeftRail';
import { StaffCompetencyForm } from '@/components/crm/StaffCompetencyForm';
import { StaffLevelsForm } from '@/components/crm/StaffLevelsForm';
import { StaffLoginRbacCell } from '@/components/crm/StaffLoginRbacCell';
import { StaffRosterIdentityCallout } from '@/components/crm/StaffRosterIdentityCallout';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import { WinExcelImportWizard } from '@/components/win';
import {
  fetchCrmStaffList,
  fetchStaffCompetency,
  fetchStaffLevels,
  fetchStaffOrgUsers,
  importCrmStaff,
  saveStaffCompetency,
  saveStaffLevels,
  staffMe,
  staffRefresh,
  type CrmStaffRow,
  type StaffOrgUserSummary,
} from '@/lib/api';
import { fetchHrWalletRosterStats, type HrWalletRosterStatDto } from '@/lib/hr-employee-file-api';
import { canLinkToOrgAdmin } from '@/lib/admin/staff-bridge';
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
import { StaffEditDrawer } from './StaffEditDrawer';

type StaffTab = 'roster' | 'import' | 'levels' | 'competency';

function parseStaffTab(raw: string | null): StaffTab {
  if (raw === 'import' || raw === 'levels' || raw === 'competency' || raw === 'roster') return raw;
  return 'roster';
}

export function StaffContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const adminBridge = searchParams.get('admin') === '1';
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [tab, setTab] = useState<StaffTab>(() => parseStaffTab(searchParams.get('tab')));
  const [rows, setRows] = useState<CrmStaffRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [orgUsersByEmail, setOrgUsersByEmail] = useState<Map<string, StaffOrgUserSummary>>(new Map());
  const [levels, setLevels] = useState<Array<Record<string, unknown>>>([]);
  const [competency, setCompetency] = useState<Record<string, unknown>>({});
  const [importJson, setImportJson] = useState('[]');
  const [rosterWizardOpen, setRosterWizardOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<CrmStaffRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [walletStats, setWalletStats] = useState<Map<number, HrWalletRosterStatDto>>(new Map());

  const rosterItems = useMemo(
    () =>
      rows.map((s) => {
        const orgUser = s.email
          ? orgUsersByEmail.get(s.email.trim().toLowerCase())
          : undefined;
        return { staff: s, orgUser };
      }),
    [rows, orgUsersByEmail],
  );

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
      if (!hasCap(me, 'crm_staff_roster', 'view')) {
        setError('Không có quyền nhân sự');
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
      if (!hasCap(me, 'crm_staff_roster', 'view')) {
        setError('Không có quyền nhân sự');
        return null;
      }
      return access;
    }
  }, [router]);

  const loadTab = useCallback(async (access: string, nextTab: StaffTab) => {
    setLoading(true);
    setError('');
    try {
      if (nextTab === 'roster') {
        const out = await fetchCrmStaffList(access, { q: query || undefined });
        setRows(out.staff ?? []);
        setSummary(out.summary ?? {});
        try {
          const ids = (out.staff ?? []).map((s) => s.id);
          const stats = await fetchHrWalletRosterStats(access, ids);
          setWalletStats(new Map(stats.map((s) => [s.staff_id, s])));
        } catch {
          setWalletStats(new Map());
        }
        if (canLinkToOrgAdmin(getStoredUser())) {
          try {
            const orgUsers = await fetchStaffOrgUsers(access, { includeInactive: true });
            setOrgUsersByEmail(
              new Map(orgUsers.map((u) => [u.email.trim().toLowerCase(), u])),
            );
          } catch {
            setOrgUsersByEmail(new Map());
          }
        } else {
          setOrgUsersByEmail(new Map());
        }
      } else if (nextTab === 'levels') {
        const levelRows = await fetchStaffLevels(access);
        setLevels(levelRows);
      } else if (nextTab === 'competency') {
        const competencyRows = await fetchStaffCompetency(access);
        setCompetency(competencyRows);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải nhân viên thất bại');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    setTab(parseStaffTab(searchParams.get('tab')));
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadTab(access, tab);
    })();
  }, [ensureAuth, tab, loadTab]);

  async function onSaveLevels(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      await saveStaffLevels(access, levels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu levels thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveCompetency(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      await saveStaffCompetency(access, competency);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu competency thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onImport(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const parsed = JSON.parse(importJson) as Array<Record<string, unknown>>;
      const out = await importCrmStaff(access, parsed);
      setImportJson('[]');
      setError('');
      alert(`Import xong: ${JSON.stringify(out)}`);
      setTab('roster');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import thất bại');
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmHrPageShell user={null} onLogout={logout} title="Nhân viên" loading>
        <span />
      </CrmHrPageShell>
    );
  }

  const canEdit = hasCap(user, 'crm_staff_roster', 'edit');
  const accessToken = getAccessToken();
  const showOrgBridge = canLinkToOrgAdmin(user);

  const rosterBody = (
    <>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {(
          [
            { id: 'roster', label: 'Roster' },
            { id: 'import', label: 'Import' },
            { id: 'levels', label: 'Levels' },
            { id: 'competency', label: 'Competency' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn btn-sm${tab === t.id ? '' : ' btn-secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading ? <p className="muted">Đang tải…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {tab === 'roster' ? (
        <>
          {showOrgBridge ? <StaffRosterIdentityCallout /> : null}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(q.trim());
            }}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên / mã…"
              style={{
                flex: 1,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0.55rem 0.75rem',
                color: 'var(--text)',
              }}
            />
            <button type="submit" className="btn btn-sm">
              Tìm
            </button>
          </form>
          <p className="muted">
            Tổng {summary.staff_total ?? rows.length} · Active {summary.staff_active ?? '—'}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Mã</th>
                  <th>Phòng</th>
                  <th>Ví %</th>
                  <th>Hết hạn</th>
                  {showOrgBridge ? <th>Login / RBAC</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rosterItems.map(({ staff: s, orgUser }) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/crm/staff/${s.id}`} className="nav-link">
                        {s.name}
                      </Link>
                      {!s.active ? <span className="muted"> · inactive</span> : null}
                    </td>
                    <td>{s.internal_code || '—'}</td>
                    <td>{s.department || '—'}</td>
                    <td>{walletStats.get(s.id)?.wallet_pct ?? '—'}%</td>
                    <td>
                      {(walletStats.get(s.id)?.expiring_count ?? 0) > 0 ? (
                        <span className="hr-expiry-chip hr-expiry-chip--expiring">
                          {walletStats.get(s.id)?.expiring_count}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    {showOrgBridge ? (
                      <td>
                        <StaffLoginRbacCell staff={s} orgUser={orgUser} viewer={user} />
                      </td>
                    ) : null}
                    <td>
                      {canEdit ? (
                        <button
                          type="button"
                          className="btn btn-link"
                          style={{ fontSize: '0.85rem', padding: 0 }}
                          onClick={() => {
                            setEditStaff(s);
                            setEditOpen(true);
                          }}
                        >
                          Sửa
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'import' && canEdit ? (
        <div className="stack-gap">
          <div>
            <p className="muted" style={{ marginTop: 0 }}>
              Import roster từ CSV/Excel theo template tiếng Việt.
            </p>
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving}
              onClick={() => setRosterWizardOpen(true)}
            >
              Import wizard (CSV/Excel)
            </button>
          </div>
          <details>
            <summary className="muted">Import JSON nâng cao</summary>
            <form onSubmit={(e) => void onImport(e)} style={{ marginTop: '0.75rem' }}>
              <p className="muted">JSON array of staff rows (name, internal_code, …)</p>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={8}
                disabled={saving}
                style={{
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.75rem',
                  color: 'var(--text)',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }}
              />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={saving} style={{ marginTop: '0.5rem' }}>
                Import JSON
              </button>
            </form>
          </details>
          {getAccessToken() ? (
            <WinExcelImportWizard
              open={rosterWizardOpen}
              mode="staff"
              token={getAccessToken()!}
              onClose={() => setRosterWizardOpen(false)}
              onComplete={() => {
                const access = getAccessToken();
                if (access) void loadTab(access, 'roster');
                setTab('roster');
              }}
              onError={(message) => setError(message)}
            />
          ) : null}
        </div>
      ) : null}

      {tab === 'levels' ? (
        <form onSubmit={(e) => void onSaveLevels(e)}>
          <StaffLevelsForm
            levels={levels as Array<Record<string, unknown>>}
            readOnly={!canEdit}
            onChange={(next) => setLevels(next as Array<Record<string, unknown>>)}
          />
          {canEdit ? (
            <button type="submit" className="btn btn-secondary btn-sm" disabled={saving} style={{ marginTop: '0.5rem' }}>
              Lưu levels
            </button>
          ) : null}
        </form>
      ) : null}

      {tab === 'competency' ? (
        <form onSubmit={(e) => void onSaveCompetency(e)}>
          <StaffCompetencyForm
            config={competency}
            readOnly={!canEdit}
            onChange={setCompetency}
          />
          {canEdit ? (
            <button
              type="submit"
              className="btn btn-secondary btn-sm"
              disabled={saving}
              style={{ marginTop: '0.5rem' }}
            >
              Lưu competency
            </button>
          ) : null}
        </form>
      ) : null}
    </>
  );

  const pageInner = (
    <div className="page-card stack-gap">
      {adminBridge ? (
        <p className="muted staff-admin-bridge-banner">
          Bridge mode — <Link href="/admin">Quản trị hệ thống</Link>
        </p>
      ) : null}
      {adminBridge ? (
        <AdminControlPlaneLayout user={user}>{rosterBody}</AdminControlPlaneLayout>
      ) : (
        rosterBody
      )}
    </div>
  );

  return (
    <CrmHrPageShell user={user} onLogout={logout} title="Nhân viên">
      {pageInner}
      {accessToken ? (
        <StaffEditDrawer
          open={editOpen}
          staff={editStaff}
          orgUser={
            editStaff?.email
              ? orgUsersByEmail.get(editStaff.email.trim().toLowerCase())
              : undefined
          }
          token={accessToken}
          canEdit={canEdit}
          viewer={user}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          }}
        />
      ) : null}
    </CrmHrPageShell>
  );
}
