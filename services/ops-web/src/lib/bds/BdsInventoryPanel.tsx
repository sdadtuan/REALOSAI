'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import {
  fetchProjectStack,
  fetchProjectUnits,
  patchUnitPool,
  postUnitImport,
  postUnitLock,
  postUnitUnlock,
} from '@/lib/bds/api';
import type { BdsImportResult, BdsStack, BdsUnit } from '@/lib/bds/types';
import { parseRequiredRowVersion } from '@/lib/bds/tx-copy';
import { w2ActionCopy } from '@/lib/bds/w2-copy';

type Props = {
  token: string;
  projectId: number;
  user: StoredStaffUser;
  mode: 'list' | 'stack';
};

const POOLS = ['inhouse', 'channel', 'reserved_vip', 'reserved_staff'] as const;

export function BdsInventoryPanel({ token, projectId, user, mode }: Props) {
  const projectIdRef = useRef(projectId);
  const [units, setUnits] = useState<BdsUnit[]>([]);
  const [stack, setStack] = useState<BdsStack | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState('unit_code\n');
  const [importResult, setImportResult] = useState<BdsImportResult | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [rowVersionRaw, setRowVersionRaw] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [pool, setPool] = useState<(typeof POOLS)[number]>('channel');

  const canImport = hasCap(user, 'bds_inventory', 'import');
  const canLock = hasCap(user, 'bds_inventory', 'lock');
  const canEdit = hasCap(user, 'bds_inventory', 'edit');

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const reload = useCallback(async () => {
    if (projectId <= 0) return;
    const pid = projectId;
    setLoadError('');
    try {
      if (mode === 'list') {
        const data = await fetchProjectUnits(token, pid);
        if (projectIdRef.current === pid) setUnits(data);
      } else {
        const data = await fetchProjectStack(token, pid);
        if (projectIdRef.current === pid) setStack(data);
      }
    } catch (err) {
      if (projectIdRef.current === pid) {
        setLoadError(err instanceof Error ? err.message : 'Tải tồn kho thất bại');
      }
    }
  }, [mode, projectId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = async (fn: () => Promise<unknown>) => {
    setActionError('');
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(w2ActionCopy(err instanceof Error ? err.message : 'Thao tác thất bại'));
    } finally {
      setBusy(false);
    }
  };

  const parsedVersion = parseRequiredRowVersion(rowVersionRaw);
  const selectedId = Number(selectedUnitId);

  if (projectId <= 0) {
    return <p className="muted">Chọn dự án hợp lệ.</p>;
  }

  return (
    <div>
      {loadError ? <p className="error">{loadError}</p> : null}
      {actionError ? <p className="error">{actionError}</p> : null}

      {mode === 'list' ? (
        <>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
            {units.map((u) => (
              <li key={u.id}>
                {u.unit_code} · {u.tower ?? '—'} · {u.status ?? '—'} · pool {u.pool ?? '—'} · rv{' '}
                {u.row_version ?? '—'}
              </li>
            ))}
          </ul>
          {canImport ? (
            <>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={4}
                disabled={busy}
                style={{
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text)',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                }}
              />
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy}
                style={{ marginTop: '0.5rem' }}
                onClick={() =>
                  void (async () => {
                    setActionError('');
                    setBusy(true);
                    try {
                      const out = await postUnitImport(token, projectId, csv);
                      setImportResult(out);
                      await reload();
                    } catch (err) {
                      setActionError(w2ActionCopy(err instanceof Error ? err.message : 'Import thất bại'));
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              >
                Import CSV
              </button>
              {importResult ? (
                <pre
                  style={{
                    marginTop: '0.75rem',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.75rem',
                    fontSize: '0.85rem',
                  }}
                >
                  imported: {importResult.imported}
                  {'\n'}
                  conflicts: {JSON.stringify(importResult.conflicts)}
                  {'\n'}
                  skipped_sold: {JSON.stringify(importResult.skipped_sold)}
                </pre>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {(stack?.towers ?? []).map((t) => (
            <div key={t.tower} style={{ marginBottom: '1rem' }}>
              <strong>{t.tower}</strong>
              {t.floors.map((f) => (
                <div key={f.floor} style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>
                  Tầng {f.floor}:{' '}
                  {f.units.map((u) => `${u.unit_code}(${u.status ?? '?'})`).join(', ') || '—'}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {(canLock || canEdit) && mode === 'list' ? (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            placeholder="unit id"
            disabled={busy}
            style={inputStyle}
          />
          <input
            value={rowVersionRaw}
            onChange={(e) => setRowVersionRaw(e.target.value)}
            placeholder="row_version (bắt buộc)"
            disabled={busy}
            style={inputStyle}
          />
          {canLock ? (
            <>
              <input
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="Lý do khóa"
                disabled={busy}
                style={inputStyle}
              />
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy || !Number.isFinite(selectedId) || parsedVersion == null}
                onClick={() =>
                  void runAction(() =>
                    postUnitLock(token, selectedId, {
                      row_version: parsedVersion!,
                      reason: lockReason,
                    }),
                  )
                }
              >
                Khóa
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy || !Number.isFinite(selectedId) || parsedVersion == null}
                onClick={() =>
                  void runAction(() =>
                    postUnitUnlock(token, selectedId, { row_version: parsedVersion! }),
                  )
                }
              >
                Mở khóa
              </button>
            </>
          ) : null}
          {canEdit ? (
            <>
              <select
                value={pool}
                onChange={(e) => setPool(e.target.value as (typeof POOLS)[number])}
                disabled={busy}
                style={selectStyle}
              >
                {POOLS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={busy || !Number.isFinite(selectedId) || parsedVersion == null}
                onClick={() =>
                  void runAction(() =>
                    patchUnitPool(token, selectedId, { row_version: parsedVersion!, pool }),
                  )
                }
              >
                Đổi pool
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const inputStyle = {
  flex: 1,
  minWidth: 100,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
} as const;

const selectStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
} as const;
