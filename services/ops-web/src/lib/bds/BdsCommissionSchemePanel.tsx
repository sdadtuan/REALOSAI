'use client';

import { useEffect, useState } from 'react';
import { hasCap } from '@/lib/auth';
import type { StoredStaffUser } from '@/lib/auth';
import {
  fetchProjectPhases,
  fetchProjectTransactions,
  postCommissionScheme,
  postCommissionSchemeActivate,
  postCommissionSchemeSplits,
  postCommissionSchemeTiers,
} from '@/lib/bds/api';
import type {
  BdsAgency,
  BdsCommissionScheme,
  BdsPhase,
  BdsSchemeSplitInput,
  BdsSchemeTierInput,
  BdsSchemeBase,
  BdsTriggerStage,
} from '@/lib/bds/types';
import { BdsProjectField } from '@/lib/bds/BdsProjectField';
import { readBdsProjectId } from '@/lib/bds/project-picker';
import { hideCommissionSchemePct } from '@/lib/bds/caps';
import { uniqueTierIdsFromAgencies } from '@/lib/bds/w3-tier-hints';
import { w3ActionCopy } from '@/lib/bds/w3-copy';

const SCHEME_STORAGE_KEY = 'bds-w3-scheme-id';
const SCHEME_STATUS_KEY = 'bds-w3-scheme-status';

const DEFAULT_SPLITS: BdsSchemeSplitInput[] = [
  { trigger_stage: 'vbtt', pct: 30 },
  { trigger_stage: 'contracted', pct: 50 },
  { trigger_stage: 'handed_over', pct: 20 },
];

const TRIGGER_LABELS: Record<BdsTriggerStage, string> = {
  vbtt: 'VBTT',
  contracted: 'HĐMB',
  handed_over: 'Bàn giao',
};

const DEPOSIT_STAGES = new Set(['deposit', 'vbtt', 'contracted']);

function splitSum(splits: BdsSchemeSplitInput[]): number {
  return splits.reduce((acc, row) => acc + Number(row.pct ?? 0), 0);
}

export function BdsCommissionSchemePanel(props: {
  token: string;
  user: StoredStaffUser | null;
  agencies: BdsAgency[];
}) {
  const canApprove = hasCap(props.user, 'bds_commission', 'approve');
  const hidePct = hideCommissionSchemePct(props.user);

  const [projectId, setProjectId] = useState(() => readBdsProjectId());
  const [phases, setPhases] = useState<BdsPhase[]>([]);
  const [phaseId, setPhaseId] = useState('');
  const [base, setBase] = useState<BdsSchemeBase>('net');
  const [schemeId, setSchemeId] = useState('');
  const [schemeStatus, setSchemeStatus] = useState('');
  const [tiers, setTiers] = useState<BdsSchemeTierInput[]>([
    { min_tier_id: '', pct: 2, product_line: '' },
  ]);
  const [splits, setSplits] = useState<BdsSchemeSplitInput[]>(DEFAULT_SPLITS);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const tierHints = uniqueTierIdsFromAgencies(props.agencies);
  const isActive = schemeStatus === 'active';
  const isDraft = schemeId && !isActive;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedId = window.sessionStorage.getItem(SCHEME_STORAGE_KEY) ?? '';
    const storedStatus = window.sessionStorage.getItem(SCHEME_STATUS_KEY) ?? '';
    if (storedId) setSchemeId(storedId);
    if (storedStatus) setSchemeStatus(storedStatus);
  }, []);

  useEffect(() => {
    if (!props.token || projectId <= 0) {
      setPhases([]);
      return;
    }
    void fetchProjectPhases(props.token, projectId)
      .then(setPhases)
      .catch(() => setPhases([]));
  }, [props.token, projectId]);

  const persistScheme = (scheme: BdsCommissionScheme) => {
    setSchemeId(scheme.id);
    setSchemeStatus(scheme.status);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SCHEME_STORAGE_KEY, scheme.id);
      window.sessionStorage.setItem(SCHEME_STATUS_KEY, scheme.status);
    }
  };

  const onCreateScheme = async () => {
    if (projectId <= 0) {
      setActionError('Chọn dự án.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const scheme = await postCommissionScheme(props.token, {
        project_id: projectId,
        phase_id: phaseId || undefined,
        base,
      });
      persistScheme(scheme);
    } catch (err) {
      setActionError(w3ActionCopy(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const onSaveTiers = async () => {
    if (!schemeId) return;
    setBusy(true);
    setActionError('');
    try {
      await postCommissionSchemeTiers(props.token, schemeId, tiers);
    } catch (err) {
      setActionError(w3ActionCopy(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const onSaveSplits = async () => {
    if (!schemeId) return;
    if (Math.abs(splitSum(splits) - 100) > 0.01) {
      setActionError('Tổng split mốc TX phải bằng 100%.');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      await postCommissionSchemeSplits(props.token, schemeId, splits);
    } catch (err) {
      setActionError(w3ActionCopy(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const onActivate = async () => {
    if (!schemeId || !canApprove) return;
    if (projectId > 0) {
      try {
        const txs = await fetchProjectTransactions(props.token, projectId);
        const hasDeposit = txs.some((tx) => DEPOSIT_STAGES.has(String(tx.stage ?? '')));
        if (hasDeposit) {
          const ok = window.confirm('Đã có cọc/giao dịch — vẫn activate?');
          if (!ok) return;
        }
      } catch {
        /* warn optional */
      }
    }
    setBusy(true);
    setActionError('');
    try {
      const scheme = await postCommissionSchemeActivate(props.token, schemeId);
      persistScheme(scheme);
    } catch (err) {
      setActionError(w3ActionCopy(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  if (!canApprove) {
    return <p className="muted">Chỉ CV HH được cấu hình scheme.</p>;
  }

  return (
    <div>
      <p className="muted" style={{ marginBottom: '1rem' }}>
        Không có GET scheme — refresh mất draft trừ khi còn sessionStorage.
      </p>
      {actionError ? <p className="error">{actionError}</p> : null}
      {schemeStatus ? (
        <p>
          Scheme hiện tại: <strong>{schemeId ? schemeId.slice(0, 8) : '—'}…</strong>{' '}
          <span className="chip">{schemeStatus}</span>
        </p>
      ) : null}

      <section style={{ marginTop: '1rem' }}>
        <h3>1. Dự án × đợt × cơ sở</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }}>
          <BdsProjectField token={props.token} value={projectId} onChange={setProjectId} />
          <label>
            Đợt{' '}
            <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} disabled={isActive}>
              <option value="">— tất cả —</option>
              {phases.map((ph) => (
                <option key={ph.id} value={ph.id}>
                  {ph.code} · {ph.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset style={{ border: 'none', padding: 0 }}>
            <legend className="muted">Cơ sở</legend>
            <label>
              <input
                type="radio"
                name="scheme-base"
                checked={base === 'net'}
                onChange={() => setBase('net')}
                disabled={isActive}
              />{' '}
              Net
            </label>{' '}
            <label>
              <input
                type="radio"
                name="scheme-base"
                checked={base === 'list'}
                onChange={() => setBase('list')}
                disabled={isActive}
              />{' '}
              List
            </label>
          </fieldset>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || isActive}
            onClick={() => void onCreateScheme()}
          >
            Tạo scheme
          </button>
        </div>
      </section>

      {schemeId ? (
        <>
          <section style={{ marginTop: '1.5rem' }}>
            <h3>2. Tier × hạng</h3>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>min_tier_id</th>
                  {!hidePct ? <th>%</th> : null}
                  <th>product_line</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tiers.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        list="tier-hints"
                        value={row.min_tier_id}
                        disabled={isActive}
                        onChange={(e) => {
                          const next = [...tiers];
                          next[idx] = { ...row, min_tier_id: e.target.value };
                          setTiers(next);
                        }}
                      />
                    </td>
                    {!hidePct ? (
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={row.pct}
                          disabled={isActive}
                          onChange={(e) => {
                            const next = [...tiers];
                            next[idx] = { ...row, pct: Number(e.target.value) };
                            setTiers(next);
                          }}
                        />
                      </td>
                    ) : null}
                    <td>
                      <input
                        value={row.product_line ?? ''}
                        disabled={isActive}
                        onChange={(e) => {
                          const next = [...tiers];
                          next[idx] = { ...row, product_line: e.target.value };
                          setTiers(next);
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        disabled={isActive || tiers.length <= 1}
                        onClick={() => setTiers(tiers.filter((_, i) => i !== idx))}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="tier-hints">
              {tierHints.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={isActive}
                onClick={() => setTiers([...tiers, { min_tier_id: '', pct: 2, product_line: '' }])}
              >
                + Hàng tier
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy || isActive}
                onClick={() => void onSaveTiers()}
              >
                Lưu tier
              </button>
            </div>
          </section>

          <section style={{ marginTop: '1.5rem' }}>
            <h3>3. Split mốc TX</h3>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Mốc</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((row, idx) => (
                  <tr key={row.trigger_stage}>
                    <td>{TRIGGER_LABELS[row.trigger_stage]}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={row.pct}
                        disabled={isActive}
                        onChange={(e) => {
                          const next = [...splits];
                          next[idx] = { ...row, pct: Number(e.target.value) };
                          setSplits(next);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">Tổng: {splitSum(splits).toFixed(2)}%</p>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || isActive}
              onClick={() => void onSaveSplits()}
            >
              Lưu split
            </button>
          </section>

          <section style={{ marginTop: '1.5rem' }}>
            <h3>4. Activate</h3>
            {isDraft ? (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => void onActivate()}
              >
                Activate scheme
              </button>
            ) : null}
            {isActive ? <p className="muted">Scheme đang active — không sửa tier/split.</p> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
