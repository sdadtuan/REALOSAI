'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { formatNumber, formatPct } from '@/lib/kpi/format';

export interface StaffKpiGridRow {
  id: number;
  staff_id: number;
  staff_name: string;
  staff_code?: string;
  metric_id: number;
  metric_name: string;
  metric_code?: string;
  metric_unit?: string;
  metric_higher_is_better?: number;
  target_value: number | null;
  actual_value: number | null;
  status?: string;
}

function achievementPct(
  higherIsBetter: number | undefined,
  target: number | null,
  actual: number | null,
): number | null {
  if (target == null || actual == null) return null;
  const t = Number(target);
  const a = Number(actual);
  if (!Number.isFinite(t) || !Number.isFinite(a) || t === 0) return null;
  const hi = Number(higherIsBetter ?? 1) === 1;
  if (hi) return Math.round(100 * Math.min(1, a / t) * 100) / 100;
  return Math.round(100 * Math.min(1, t / Math.max(a, 1e-9)) * 100) / 100;
}

function statusClass(status: string | undefined): string {
  const st = String(status ?? 'draft').toLowerCase();
  if (st === 'achieved' || st === 'ok') return 'kpi-grid-status--ok';
  if (st === 'missed') return 'kpi-grid-status--missed';
  if (st === 'at_risk') return 'kpi-grid-status--warn';
  return 'kpi-grid-status--draft';
}

function statusLabel(status: string | undefined): string {
  const st = String(status ?? 'draft').toLowerCase();
  if (st === 'achieved' || st === 'ok') return 'Đạt';
  if (st === 'missed') return 'Không đạt';
  if (st === 'at_risk') return 'Rủi ro';
  return 'Nháp';
}

export function KpiEditableGrid({
  rows,
  canEdit,
  onPatch,
  onSaved,
}: {
  rows: StaffKpiGridRow[];
  canEdit: boolean;
  onPatch: (kpiId: number, actual: number | null) => Promise<void>;
  onSaved?: () => void | Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    setDrafts({});
    setError('');
    setSavedMsg('');
  }, [rows]);

  const dirtyIds = useMemo(() => {
    return rows
      .filter((row) => {
        const draft = drafts[row.id];
        if (draft == null) return false;
        const parsed = draft.trim() === '' ? null : Number(draft);
        const current = row.actual_value;
        if (parsed == null && (current == null || current === ('' as unknown))) return false;
        if (parsed != null && current != null && parsed === Number(current)) return false;
        return true;
      })
      .map((row) => row.id);
  }, [rows, drafts]);

  function displayActual(row: StaffKpiGridRow): number | null {
    const draft = drafts[row.id];
    if (draft == null || draft.trim() === '') {
      return row.actual_value;
    }
    const parsed = Number(draft);
    return Number.isFinite(parsed) ? parsed : row.actual_value;
  }

  function validateDraft(raw: string): string | null {
    if (raw.trim() === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 'Actual phải là số';
    if (n < 0) return 'Actual phải ≥ 0';
    return null;
  }

  async function saveDirty(ids: number[]) {
    if (!canEdit || ids.length === 0) return;
    setError('');
    setSavedMsg('');
    for (const id of ids) {
      const raw = drafts[id] ?? '';
      const validation = validateDraft(raw);
      if (validation) {
        setError(validation);
        return;
      }
    }
    setSaving(true);
    try {
      for (const id of ids) {
        const raw = drafts[id] ?? '';
        const actual = raw.trim() === '' ? null : Number(raw);
        await onPatch(id, actual);
      }
      setDrafts((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      setSavedMsg(`Đã lưu ${ids.length} chỉ tiêu`);
      await onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu KPI thất bại');
    } finally {
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return <p className="muted">Chưa có bản ghi KPI cho kỳ đã chọn.</p>;
  }

  return (
    <div className="kpi-editable-grid">
      <div className="kpi-editable-grid__toolbar">
        <p className="muted kpi-editable-grid__hint">
          {canEdit
            ? 'Nhập actual trực tiếp — lưu một hoặc nhiều ô cùng lúc.'
            : 'Chế độ chỉ xem — cần quyền crm_kpi_records:edit để nhập actual.'}
        </p>
        {canEdit ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving || dirtyIds.length === 0}
            onClick={() => void saveDirty(dirtyIds)}
          >
            {saving ? 'Đang lưu…' : `Lưu thay đổi${dirtyIds.length ? ` (${dirtyIds.length})` : ''}`}
          </button>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {savedMsg ? <p className="muted kpi-editable-grid__saved">{savedMsg}</p> : null}

      <div className="crm-leads-table-wrap">
        <table className="perf-table kpi-editable-grid__table" aria-label="Bảng KPI nhân viên">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Chỉ tiêu</th>
              <th style={{ textAlign: 'right' }}>Target</th>
              <th style={{ textAlign: 'right' }}>Actual</th>
              <th style={{ textAlign: 'right' }}>% đạt</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const actual = displayActual(row);
              const pct = achievementPct(row.metric_higher_is_better, row.target_value, actual);
              const draftValue = drafts[row.id] ?? (row.actual_value == null ? '' : String(row.actual_value));
              const isDirty = dirtyIds.includes(row.id);
              return (
                <tr key={row.id} className={isDirty ? 'kpi-editable-grid__row--dirty' : undefined}>
                  <td>
                    <Link href={`/crm/staff/${row.staff_id}`} className="nav-link">
                      {row.staff_name}
                    </Link>
                    {row.staff_code ? <span className="muted kpi-editable-grid__code"> {row.staff_code}</span> : null}
                  </td>
                  <td>
                    {row.metric_code ? <span className="muted">[{row.metric_code}] </span> : null}
                    {row.metric_name}
                    {row.metric_unit ? <span className="muted"> ({row.metric_unit})</span> : null}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatNumber(row.target_value)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {canEdit ? (
                      <input
                        type="number"
                        min={0}
                        step="any"
                        className="kpi-input kpi-editable-grid__actual-input"
                        value={draftValue}
                        aria-label={`Actual ${row.metric_name} — ${row.staff_name}`}
                        onChange={(e) => {
                          setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }));
                          setSavedMsg('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveDirty([row.id]);
                          }
                        }}
                      />
                    ) : (
                      formatNumber(row.actual_value)
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>{pct == null ? '—' : formatPct(pct)}</td>
                  <td>
                    <span className={`kpi-grid-status ${statusClass(row.status)}`}>{statusLabel(row.status)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
