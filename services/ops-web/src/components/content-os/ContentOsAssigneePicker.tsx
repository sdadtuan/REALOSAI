'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchCrmStaffList, type CrmStaffRow } from '@/lib/api';
import { patchContentOsItemAssignees, type ContentOsItem } from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  item: ContentOsItem;
  canAssign: boolean;
  onChanged: () => Promise<void> | void;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export function ContentOsAssigneePicker({
  token,
  lifecycleId,
  item,
  canAssign,
  onChanged,
  onError,
  onMessage,
}: Props) {
  const [staff, setStaff] = useState<CrmStaffRow[]>([]);
  const [spId, setSpId] = useState(String(item.assignee_sp ?? ''));
  const [qaId, setQaId] = useState(String(item.assignee_qa ?? ''));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSpId(String(item.assignee_sp ?? ''));
    setQaId(String(item.assignee_qa ?? ''));
  }, [item.assignee_sp, item.assignee_qa]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchCrmStaffList(token);
        setStaff((res.staff ?? []).filter((s) => s.active !== 0));
      } catch {
        /* roster optional */
      }
    })();
  }, [token]);

  const save = useCallback(async () => {
    if (!canAssign) return;
    setBusy(true);
    onError('');
    try {
      await patchContentOsItemAssignees(token, lifecycleId, item.id, {
        assignee_sp: spId ? Number(spId) : null,
        assignee_qa: qaId ? Number(qaId) : null,
      });
      onMessage('Đã cập nhật assignee');
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Cập nhật assignee thất bại');
    } finally {
      setBusy(false);
    }
  }, [canAssign, token, lifecycleId, item.id, spId, qaId, onChanged, onError, onMessage]);

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.35rem 0.5rem',
    color: 'var(--text)',
    minWidth: 160,
  };

  return (
    <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.5rem' }}>
      <strong style={{ fontSize: '0.82rem' }}>Phân công</strong>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.78rem' }}>
          <span className="muted">SP</span>
          <select
            value={spId}
            onChange={(e) => setSpId(e.target.value)}
            disabled={!canAssign || busy}
            style={selectStyle}
          >
            <option value="">—</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.id} {s.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.78rem' }}>
          <span className="muted">QA</span>
          <select
            value={qaId}
            onChange={(e) => setQaId(e.target.value)}
            disabled={!canAssign || busy}
            style={selectStyle}
          >
            <option value="">—</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.id} {s.name}
              </option>
            ))}
          </select>
        </label>
        {canAssign ? (
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => void save()}>
            Lưu assign
          </button>
        ) : (
          <span className="muted" style={{ fontSize: '0.78rem' }}>
            Cần quyền crm_content.assign
          </span>
        )}
      </div>
    </div>
  );
}
