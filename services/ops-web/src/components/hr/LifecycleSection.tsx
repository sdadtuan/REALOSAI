'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchHrStaffLifecycle,
  patchHrStaffLifecycle,
  type HrStaffLifecycleDto,
} from '@/lib/hr-employee-file-api';

const STAGES = [
  ['offer', 'Offer'],
  ['onboard_docs', 'Onboard giấy tờ'],
  ['probation', 'Thử việc'],
  ['official', 'Chính thức'],
  ['transfer', 'Chuyển bộ phận'],
  ['notice', 'Thông báo nghỉ'],
  ['offboard_hold', 'Offboard'],
  ['archived', 'Lưu trữ'],
] as const;

const GATE_LABELS: Record<string, string> = {
  active_contract: 'HĐLĐ active',
  cccd: 'CCCD',
  legal_name: 'Họ tên pháp lý',
  permanent_address: 'Địa chỉ thường trú',
};

type Props = {
  staffId: number;
  token: string;
  canEdit: boolean;
  initial?: HrStaffLifecycleDto | null;
  onLifecycleChange?: (lifecycle: HrStaffLifecycleDto | null) => void;
};

export function LifecycleSection({ staffId, token, canEdit, initial, onLifecycleChange }: Props) {
  const [lifecycle, setLifecycle] = useState<HrStaffLifecycleDto | null>(initial ?? null);
  const [gateMissing, setGateMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchHrStaffLifecycle(token, staffId);
      setLifecycle(out.lifecycle);
      setGateMissing(out.official_gate?.missing ?? []);
      setNotes(out.lifecycle.notes ?? '');
      onLifecycleChange?.(out.lifecycle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải lifecycle');
    } finally {
      setLoading(false);
    }
  }, [onLifecycleChange, staffId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStage(stage: string) {
    if (!canEdit) return;
    setSaving(true);
    setError('');
    try {
      const out = await patchHrStaffLifecycle(token, staffId, { stage, notes });
      setLifecycle(out.lifecycle);
      setGateMissing([]);
      onLifecycleChange?.(out.lifecycle);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chuyển stage thất bại';
      setError(msg);
      if (msg.includes('official_gate')) void load();
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!canEdit || !lifecycle) return;
    setSaving(true);
    setError('');
    try {
      const out = await patchHrStaffLifecycle(token, staffId, { notes });
      setLifecycle(out.lifecycle);
      onLifecycleChange?.(out.lifecycle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu ghi chú thất bại');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !lifecycle) {
    return <p className="muted">Đang tải lifecycle…</p>;
  }

  const currentStage = lifecycle?.stage ?? 'offer';

  return (
    <section className="page-card">
      <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Lifecycle nhân sự</h2>
      {error ? <p className="error">{error}</p> : null}
      <div className="hr-lifecycle-track" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
        {STAGES.map(([stage, label]) => {
          const active = stage === currentStage;
          const passed = STAGES.findIndex(([s]) => s === stage) <= STAGES.findIndex(([s]) => s === currentStage);
          return (
            <button
              key={stage}
              type="button"
              disabled={!canEdit || saving}
              className={`hr-expiry-chip${active ? ' hr-expiry-chip--expiring' : passed ? ' hr-expiry-chip--ok' : ' hr-expiry-chip--muted'}`}
              style={{ cursor: canEdit ? 'pointer' : 'default', border: 'none' }}
              onClick={() => void changeStage(stage)}
              title={canEdit ? `Chuyển sang ${label}` : label}
            >
              {label}
            </button>
          );
        })}
      </div>
      {lifecycle?.stage_changed_on ? (
        <p className="muted" style={{ margin: '0.65rem 0 0', fontSize: '0.85rem' }}>
          Cập nhật stage: {lifecycle.stage_changed_on.slice(0, 10)}
        </p>
      ) : null}
      {gateMissing.length > 0 ? (
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
          Cần trước khi <strong>Chính thức</strong>:{' '}
          {gateMissing.map((k) => GATE_LABELS[k] ?? k).join(' · ')}
        </p>
      ) : null}
      <label className="form-field" style={{ marginTop: '0.75rem' }}>
        <span className="form-label">Ghi chú lifecycle</span>
        <textarea
          className="form-input"
          rows={2}
          value={notes}
          disabled={!canEdit}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      {canEdit ? (
        <footer style={{ marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={saving}
            onClick={() => void saveNotes()}
          >
            Lưu ghi chú
          </button>
        </footer>
      ) : null}
    </section>
  );
}
