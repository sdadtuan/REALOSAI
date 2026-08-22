'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import {
  createCrmCustomField,
  deleteCrmCustomField,
  fetchCrmCustomFields,
  staffMe,
  staffRefresh,
  updateCrmCustomField,
  type CrmCustomFieldDef,
  type CrmCustomFieldEntityType,
  type CrmCustomFieldType,
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

const ENTITY_TYPES: Array<{ value: CrmCustomFieldEntityType; label: string }> = [
  { value: 'lead', label: 'Lead' },
  { value: 'customer', label: 'Customer' },
  { value: 'case', label: 'Deal / Case' },
];

const FIELD_TYPES: CrmCustomFieldType[] = ['text', 'number', 'select', 'date', 'boolean'];

export default function AdminCrmCustomFieldsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [entityFilter, setEntityFilter] = useState<CrmCustomFieldEntityType>('lead');
  const [rows, setRows] = useState<CrmCustomFieldDef[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ label: '', options: '', required: false });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    field_key: '',
    label: '',
    field_type: 'text' as CrmCustomFieldType,
    options: '',
    required: false,
  });

  const canConfigure = hasCap(user, 'crm_data_config', 'configure');
  const visibleRows = useMemo(
    () => rows.filter((r) => r.entity_type === entityFilter),
    [rows, entityFilter],
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
    const data = await fetchCrmCustomFields(access);
    setRows(data.fields);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải custom fields thất bại');
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
      await createCrmCustomField(access, {
        entity_type: entityFilter,
        ...form,
        options: form.options
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      });
      setForm({ field_key: '', label: '', field_type: 'text', options: '', required: false });
      await reload(access);
      setMsg('Đã tạo custom field');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo custom field thất bại');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: CrmCustomFieldDef) {
    setEditId(row.id);
    setEditDraft({
      label: row.label,
      options: row.options.join(', '),
      required: row.required,
    });
  }

  async function saveEdit() {
    const access = getAccessToken();
    if (!access || !canConfigure || editId == null) return;
    setBusy(true);
    setError('');
    try {
      await updateCrmCustomField(access, editId, {
        label: editDraft.label,
        required: editDraft.required,
        options: editDraft.options
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      });
      setEditId(null);
      await reload(access);
      setMsg('Đã cập nhật field');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: CrmCustomFieldDef) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    setBusy(true);
    setError('');
    try {
      await updateCrmCustomField(access, row.id, { active: !row.active });
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    const access = getAccessToken();
    if (!access || !canConfigure) return;
    if (!window.confirm('Xóa custom field này?')) return;
    setBusy(true);
    setError('');
    try {
      await deleteCrmCustomField(access, id);
      await reload(access);
      setMsg('Đã xóa custom field');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AdminPageShell user={null} onLogout={logout} section="crm-config" title="Custom fields" loading>
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Custom fields"
      subtitle="HubSpot-style · trường mở rộng lead / customer / case (RNOS-35)"
    >
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        <div className="admin-hubspot-layout">
          <aside className="admin-hubspot-layout__nav" aria-label="Entity">
            {ENTITY_TYPES.map((entity) => (
              <button
                key={entity.value}
                type="button"
                className={`admin-hubspot-layout__nav-btn${
                  entityFilter === entity.value ? ' admin-hubspot-layout__nav-btn--active' : ''
                }`}
                onClick={() => setEntityFilter(entity.value)}
              >
                {entity.label}
                <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                  {rows.filter((r) => r.entity_type === entity.value).length} fields
                </span>
              </button>
            ))}
          </aside>

          <div className="admin-hubspot-layout__main stack-gap">
            {canConfigure ? (
              <form onSubmit={(e) => void handleCreate(e)} className="admin-crm-form">
                <h3 className="kpi-section-title">Thêm field · {entityFilter}</h3>
                <div className="admin-crm-form__grid">
                  <input
                    className="kpi-input"
                    placeholder="field_key"
                    value={form.field_key}
                    onChange={(e) => setForm({ ...form, field_key: e.target.value })}
                    required
                  />
                  <input
                    className="kpi-input"
                    placeholder="Nhãn hiển thị"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    required
                  />
                  <select
                    className="kpi-select"
                    value={form.field_type}
                    onChange={(e) => setForm({ ...form, field_type: e.target.value as CrmCustomFieldType })}
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    className="kpi-input"
                    placeholder="Options (select, cách nhau bởi dấu phẩy)"
                    value={form.options}
                    onChange={(e) => setForm({ ...form, options: e.target.value })}
                  />
                  <label className="admin-crm-checkbox">
                    <input
                      type="checkbox"
                      checked={form.required}
                      onChange={(e) => setForm({ ...form, required: e.target.checked })}
                    />
                    Bắt buộc
                  </label>
                </div>
                <button type="submit" className="btn btn-sm" disabled={busy}>
                  {busy ? 'Đang lưu…' : 'Thêm field'}
                </button>
              </form>
            ) : (
              <p className="muted">Chế độ chỉ xem — cần quyền configure để sửa.</p>
            )}

            <div className="data-table-wrap">
              <table className="data-table perf-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Nhãn</th>
                    <th>Loại</th>
                    <th>Options</th>
                    <th>Active</th>
                    {canConfigure ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={canConfigure ? 6 : 5} className="muted">
                        Chưa có field cho {entityFilter}
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.field_key}</td>
                        <td>
                          {editId === row.id ? (
                            <input
                              className="kpi-input"
                              value={editDraft.label}
                              onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                            />
                          ) : (
                            row.label
                          )}
                        </td>
                        <td>{row.field_type}</td>
                        <td>
                          {editId === row.id ? (
                            <input
                              className="kpi-input"
                              value={editDraft.options}
                              onChange={(e) => setEditDraft({ ...editDraft, options: e.target.value })}
                            />
                          ) : (
                            row.options.join(', ') || '—'
                          )}
                        </td>
                        <td>{row.active ? 'Có' : 'Ẩn'}</td>
                        {canConfigure ? (
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {editId === row.id ? (
                              <>
                                <button type="button" className="btn btn-sm" onClick={() => void saveEdit()}>
                                  Lưu
                                </button>{' '}
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditId(null)}>
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => startEdit(row)}>
                                  Sửa
                                </button>{' '}
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => void toggleActive(row)}>
                                  {row.active ? 'Ẩn' : 'Bật'}
                                </button>{' '}
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => void handleDelete(row.id)}>
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
        </div>
      </div>
    </AdminPageShell>
  );
}
