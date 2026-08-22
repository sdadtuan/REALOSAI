'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FilterBar,
  FilterBarActions,
  HubPageLayout,
  StaffPageShell,
} from '@/components/layout';
import {
  fetchB2bUnmatched,
  mapB2bUnmatched,
  type B2bUnmatchedRow,
} from '@/lib/b2b-unmatched-api';
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

export default function B2bUnmatchedPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<B2bUnmatchedRow[]>([]);
  const [projects, setProjects] = useState<B2bProjectListItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mappingId, setMappingId] = useState<string | null>(null);
  const [projectByRow, setProjectByRow] = useState<Record<string, string>>({});
  const [pageByRow, setPageByRow] = useState<Record<string, string>>({});

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
      if (!hasCap(me, 'crm_b2b_projects', 'manage')) {
        setError('Chỉ GDKD (crm_b2b_projects.manage) mới mở workbench unmatched');
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
    setLoading(true);
    setError('');
    try {
      const [items, projectList] = await Promise.all([
        fetchB2bUnmatched(access, { limit: 100 }),
        fetchB2bProjects(access),
      ]);
      setRows(items);
      setProjects(projectList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải unmatched thất bại');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await reload(access);
    })();
  }, [ensureAuth, reload]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  async function handleMap(row: B2bUnmatchedRow) {
    const access = getAccessToken();
    const projectId = projectByRow[row.id];
    if (!access || !projectId) {
      setError('Chọn dự án trước khi gắn');
      return;
    }
    setMappingId(row.id);
    setError('');
    try {
      const isFacebook = row.channel === 'facebook' || row.channel === 'meta';
      await mapB2bUnmatched(access, row.id, {
        project_id: projectId,
        page_id: isFacebook ? pageByRow[row.id]?.trim() || undefined : undefined,
      });
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gắn dự án thất bại');
    } finally {
      setMappingId(null);
    }
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user}>
      <HubPageLayout
        title="Ingress chưa map"
        subtitle="Form/OA/webform chưa gắn dự án — không hiển thị payload (PII)."
      >
        <FilterBar>
          <FilterBarActions>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void ensureAuth().then((t) => {
                  if (t) void reload(t);
                });
              }}
            >
              Làm mới
            </button>
          </FilterBarActions>
        </FilterBar>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="crm-leads-table-wrap data-table-wrap">
          <table className="data-table perf-table">
            <thead>
              <tr>
                <th>Kênh</th>
                <th>Slug dự án</th>
                <th>External key</th>
                <th>Thời gian</th>
                <th>Gắn dự án</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isFacebook = row.channel === 'facebook' || row.channel === 'meta';
                return (
                  <tr key={row.id}>
                    <td>{row.channel}</td>
                    <td>{row.project_slug ?? '—'}</td>
                    <td>
                      <code>{row.external_key}</code>
                    </td>
                    <td>{row.created_at?.slice(0, 19).replace('T', ' ') ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                        <select
                          className="input input-sm"
                          value={projectByRow[row.id] ?? ''}
                          onChange={(e) =>
                            setProjectByRow((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                        >
                          <option value="">— Dự án —</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} · {p.name}
                            </option>
                          ))}
                        </select>
                        {isFacebook ? (
                          <input
                            className="input input-sm"
                            placeholder="page_id"
                            value={pageByRow[row.id] ?? ''}
                            onChange={(e) =>
                              setPageByRow((prev) => ({ ...prev, [row.id]: e.target.value }))
                            }
                          />
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={mappingId === row.id}
                          onClick={() => void handleMap(row)}
                        >
                          {mappingId === row.id ? 'Đang gắn…' : 'Gắn'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Không có ingress unmatched.
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Đang tải…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </HubPageLayout>
    </StaffPageShell>
  );
}
