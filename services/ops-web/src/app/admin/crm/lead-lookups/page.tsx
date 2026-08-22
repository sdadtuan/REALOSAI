'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { SegmentedControl } from '@/components/layout';
import {
  createCrmLeadLookup,
  deleteCrmLeadLookup,
  fetchCrmLeadLookups,
  staffMe,
  staffRefresh,
  updateCrmLeadLookup,
  type CrmLeadLookupKind,
  type CrmLeadLookupOption,
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

const KIND_TABS: { id: CrmLeadLookupKind; label: string }[] = [
  { id: 'source', label: 'Nguồn lead' },
  { id: 'channel', label: 'Kênh lead' },
];

export default function AdminCrmLeadLookupsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [kind, setKind] = useState<CrmLeadLookupKind>('source');
  const [rows, setRows] = useState<CrmLeadLookupOption[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ option_key: '', label: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');
  const filteredRows = useMemo(() => rows.filter((row) => row.kind === kind), [rows, kind]);

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
    const data = await fetchCrmLeadLookups(access);
    setRows(data.options);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải cấu hình thất bại');
      }
    })();
  }, [ensureAuth, reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await createCrmLeadLookup(access, {
        kind,
        option_key: form.option_key.trim() || undefined,
        label: form.label.trim(),
      });
      setForm({ option_key: '', label: '' });
      await reload(access);
      setMsg(`Đã thêm ${kind === 'source' ? 'nguồn' : 'kênh'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(row: CrmLeadLookupOption) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    try {
      await updateCrmLeadLookup(access, row.id, { label: editLabel.trim() });
      setEditingId(null);
      await reload(access);
      setMsg('Đã cập nhật');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: CrmLeadLookupOption) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    try {
      await updateCrmLeadLookup(access, row.id, { active: !row.active });
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row: CrmLeadLookupOption) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    if (!window.confirm(`Xóa "${row.label}" (${row.option_key})?`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteCrmLeadLookup(access, row.id);
      await reload(access);
      setMsg('Đã xóa');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AdminPageShell
        user={null}
        onLogout={logout}
        section="crm-config"
        title="Nguồn & Kênh lead"
        subtitle="Danh mục select cho form tạo lead"
        loading
      >
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Nguồn & Kênh lead"
      subtitle="Danh mục select cho form tạo lead — thêm, sửa, ẩn hoặc xóa"
    >
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        <SegmentedControl
          label="Loại"
          options={KIND_TABS}
          value={kind}
          onChange={(id) => setKind(id as CrmLeadLookupKind)}
        />

        {canConfigure ? (
          <form onSubmit={(e) => void handleCreate(e)} className="admin-crm-form">
            <h3 className="kpi-section-title">Thêm {kind === 'source' ? 'nguồn' : 'kênh'}</h3>
            <div className="admin-crm-form__grid">
              <input
                className="kpi-input"
                placeholder="Mã (tuỳ chọn, vd: zalo_oa)"
                value={form.option_key}
                onChange={(e) => setForm({ ...form, option_key: e.target.value })}
              />
              <input
                className="kpi-input"
                placeholder="Nhãn hiển thị *"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-sm" disabled={busy}>
              {busy ? 'Đang lưu…' : 'Thêm'}
            </button>
          </form>
        ) : (
          <p className="muted">Chế độ chỉ xem — cần quyền configure để sửa.</p>
        )}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Nhãn</th>
                <th>Thứ tự</th>
                <th>Active</th>
                {canConfigure ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={canConfigure ? 5 : 4} className="muted">
                    Chưa có mục nào
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <code>{row.option_key}</code>
                    </td>
                    <td>
                      {editingId === row.id ? (
                        <input
                          className="kpi-input"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        row.label
                      )}
                    </td>
                    <td>{row.sort_order}</td>
                    <td>{row.active ? 'Có' : 'Ẩn'}</td>
                    {canConfigure ? (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {editingId === row.id ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={busy}
                              onClick={() => void saveEdit(row)}
                            >
                              Lưu
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => setEditingId(null)}
                            >
                              Huỷ
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setEditingId(row.id);
                                setEditLabel(row.label);
                              }}
                            >
                              Sửa
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => void toggleActive(row)}
                            >
                              {row.active ? 'Ẩn' : 'Bật'}
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => void handleDelete(row)}
                            >
                              Xóa
                            </button>
                          </>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  );
}
