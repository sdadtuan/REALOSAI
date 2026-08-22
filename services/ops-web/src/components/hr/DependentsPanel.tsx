'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createHrStaffDependent,
  deleteHrStaffDependent,
  fetchHrStaffDependents,
  patchHrStaffDependent,
  type HrStaffDependentDto,
} from '@/lib/hr-employee-file-api';

type Props = {
  staffId: number;
  token: string;
  canEdit: boolean;
  canViewPii: boolean;
};

const RELATION_OPTIONS = [
  ['con', 'Con'],
  ['vo_chong', 'Vợ/Chồng'],
  ['cha_me', 'Cha/Mẹ'],
  ['khac', 'Khác'],
] as const;

function emptyDraft(): Record<string, string> {
  return {
    name: '',
    relation: 'con',
    dob: '',
    tax_dependent: '1',
    cccd: '',
    notes: '',
  };
}

export function DependentsPanel({ staffId, token, canEdit, canViewPii }: Props) {
  const [dependents, setDependents] = useState<HrStaffDependentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchHrStaffDependents(token, staffId);
      setDependents(out.dependents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải người phụ thuộc');
    } finally {
      setLoading(false);
    }
  }, [staffId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError('');
    try {
      const out = await createHrStaffDependent(token, staffId, {
        name: draft.name,
        relation: draft.relation,
        dob: draft.dob || null,
        tax_dependent: draft.tax_dependent === '1',
        cccd: draft.cccd,
        notes: draft.notes,
      });
      setDependents((prev) => [...prev, out.dependent]);
      setDraft(emptyDraft());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm thất bại');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: HrStaffDependentDto) {
    setEditingId(row.id);
    setEditDraft({
      name: row.name,
      relation: row.relation,
      dob: row.dob ?? '',
      tax_dependent: row.tax_dependent ? '1' : '0',
      cccd: row.cccd ?? '',
      notes: row.notes ?? '',
    });
  }

  async function saveEdit(depId: number) {
    if (!canEdit) return;
    setSaving(true);
    setError('');
    try {
      const out = await patchHrStaffDependent(token, staffId, depId, {
        name: editDraft.name,
        relation: editDraft.relation,
        dob: editDraft.dob || null,
        tax_dependent: editDraft.tax_dependent === '1',
        cccd: editDraft.cccd,
        notes: editDraft.notes,
      });
      setDependents((prev) => prev.map((d) => (d.id === depId ? out.dependent : d)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function remove(depId: number) {
    if (!canEdit || !window.confirm('Xóa người phụ thuộc này?')) return;
    setSaving(true);
    try {
      await deleteHrStaffDependent(token, staffId, depId);
      setDependents((prev) => prev.filter((d) => d.id !== depId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa thất bại');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Đang tải gia đình…</p>;

  return (
    <div className="stack-gap">
      {error ? <p className="error">{error}</p> : null}

      <section className="page-card">
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Người phụ thuộc</h2>
        {dependents.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Chưa có người phụ thuộc.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Quan hệ</th>
                  <th>Ngày sinh</th>
                  <th>PT TNCN</th>
                  <th>CCCD</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dependents.map((row) =>
                  editingId === row.id ? (
                    <tr key={row.id}>
                      <td colSpan={6}>
                        <div className="form-grid form-grid--2" style={{ marginTop: '0.5rem' }}>
                          <label className="form-field">
                            <span className="form-label">Họ tên</span>
                            <input
                              className="form-input"
                              value={editDraft.name}
                              onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                            />
                          </label>
                          <label className="form-field">
                            <span className="form-label">Quan hệ</span>
                            <select
                              className="form-input"
                              value={editDraft.relation}
                              onChange={(e) => setEditDraft((d) => ({ ...d, relation: e.target.value }))}
                            >
                              {RELATION_OPTIONS.map(([v, l]) => (
                                <option key={v} value={v}>
                                  {l}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="form-field">
                            <span className="form-label">Ngày sinh</span>
                            <input
                              type="date"
                              className="form-input"
                              value={editDraft.dob}
                              onChange={(e) => setEditDraft((d) => ({ ...d, dob: e.target.value }))}
                            />
                          </label>
                          <label className="form-field">
                            <span className="form-label">PT giảm trừ TNCN</span>
                            <select
                              className="form-input"
                              value={editDraft.tax_dependent}
                              onChange={(e) =>
                                setEditDraft((d) => ({ ...d, tax_dependent: e.target.value }))
                              }
                            >
                              <option value="1">Có</option>
                              <option value="0">Không</option>
                            </select>
                          </label>
                          <label className="form-field">
                            <span className="form-label">CCCD</span>
                            <input
                              className="form-input mono"
                              value={editDraft.cccd}
                              disabled={!canViewPii}
                              onChange={(e) => setEditDraft((d) => ({ ...d, cccd: e.target.value }))}
                            />
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={saving}
                            onClick={() => void saveEdit(row.id)}
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => setEditingId(null)}
                          >
                            Hủy
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{RELATION_OPTIONS.find(([k]) => k === row.relation)?.[1] ?? row.relation}</td>
                      <td className="mono">{row.dob?.slice(0, 10) ?? '—'}</td>
                      <td>{row.tax_dependent ? 'Có' : 'Không'}</td>
                      <td className="mono">{row.cccd || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {canEdit ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              onClick={() => startEdit(row)}
                            >
                              Sửa
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-sm btn-secondary"
                              disabled={saving}
                              onClick={() => void remove(row.id)}
                            >
                              Xóa
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canEdit ? (
        <section className="page-card">
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Thêm người phụ thuộc</h2>
          <form onSubmit={(e) => void handleCreate(e)} className="form-grid form-grid--2">
            <label className="form-field">
              <span className="form-label">Họ tên *</span>
              <input
                className="form-input"
                required
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Quan hệ</span>
              <select
                className="form-input"
                value={draft.relation}
                onChange={(e) => setDraft((d) => ({ ...d, relation: e.target.value }))}
              >
                {RELATION_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">Ngày sinh</span>
              <input
                type="date"
                className="form-input"
                value={draft.dob}
                onChange={(e) => setDraft((d) => ({ ...d, dob: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">PT giảm trừ TNCN</span>
              <select
                className="form-input"
                value={draft.tax_dependent}
                onChange={(e) => setDraft((d) => ({ ...d, tax_dependent: e.target.value }))}
              >
                <option value="1">Có</option>
                <option value="0">Không</option>
              </select>
            </label>
            <label className="form-field">
              <span className="form-label">CCCD</span>
              <input
                className="form-input mono"
                value={draft.cccd}
                disabled={!canViewPii}
                onChange={(e) => setDraft((d) => ({ ...d, cccd: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span className="form-label">Ghi chú</span>
              <input
                className="form-input"
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              />
            </label>
            <footer style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                {saving ? 'Đang lưu…' : 'Thêm'}
              </button>
            </footer>
          </form>
        </section>
      ) : null}
    </div>
  );
}
