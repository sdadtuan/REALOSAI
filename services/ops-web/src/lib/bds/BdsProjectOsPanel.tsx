'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import {
  fetchPlanRevisions,
  fetchProjectLegalDocs,
  fetchProjectMilestones,
  fetchProjectPhases,
  fetchProjectTowers,
  postLegalGate,
  postMilestoneReach,
  postPhaseClose,
  postPhaseOpen,
  postPlanApprove,
  postPlanRevision,
  postProjectLegalDoc,
  postProjectMilestone,
  postProjectPhase,
  postProjectTower,
} from '@/lib/bds/api';
import type { BdsLegalDoc, BdsMilestone, BdsPhase, BdsPlanRevision, BdsTower } from '@/lib/bds/types';
import { w2ActionCopy } from '@/lib/bds/w2-copy';

export type BdsProjectOsSection = 'legal' | 'towers' | 'phases' | 'milestones' | 'plans';

const LEGAL_DOC_TYPES = [
  'quy_hoach_1_500',
  'qsd_dat',
  'nghia_vu_tai_chinh',
  'gpxd',
  'nghiem_thu_mong',
  'bao_lanh_nh',
  'so_xd_du_dieu_kien_ban',
] as const;

type Props = {
  token: string;
  projectId: number;
  user: StoredStaffUser;
  section: BdsProjectOsSection;
};

export function BdsProjectOsPanel({ token, projectId, user, section }: Props) {
  const projectIdRef = useRef(projectId);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const [legalDocs, setLegalDocs] = useState<BdsLegalDoc[]>([]);
  const [towers, setTowers] = useState<BdsTower[]>([]);
  const [phases, setPhases] = useState<BdsPhase[]>([]);
  const [milestones, setMilestones] = useState<BdsMilestone[]>([]);
  const [plans, setPlans] = useState<BdsPlanRevision[]>([]);

  const [docType, setDocType] = useState<string>(LEGAL_DOC_TYPES[0]);
  const [gateReason, setGateReason] = useState('');
  const [towerCode, setTowerCode] = useState('');
  const [towerName, setTowerName] = useState('');
  const [phaseCode, setPhaseCode] = useState('');
  const [phaseName, setPhaseName] = useState('');
  const [milestoneCode, setMilestoneCode] = useState('');
  const [milestoneName, setMilestoneName] = useState('');
  const [milestoneDate, setMilestoneDate] = useState('');
  const [planKind, setPlanKind] = useState('business');

  const canLegalApprove = hasCap(user, 'bds_legal', 'approve');
  const canProjectOsEdit = hasCap(user, 'bds_project_os', 'edit');
  const canProjectOsApprove = hasCap(user, 'bds_project_os', 'approve');

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const runAction = async (fn: () => Promise<unknown>) => {
    setActionError('');
    setBusy(true);
    try {
      await fn();
      await reload(section);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thao tác thất bại';
      setActionError(w2ActionCopy(msg));
    } finally {
      setBusy(false);
    }
  };

  const reload = useCallback(
    async (target: BdsProjectOsSection) => {
      if (projectId <= 0) return;
      const pid = projectId;
      setLoadError('');
      try {
        if (target === 'legal') {
          const data = await fetchProjectLegalDocs(token, pid);
          if (projectIdRef.current === pid) setLegalDocs(data);
        } else if (target === 'towers') {
          const data = await fetchProjectTowers(token, pid);
          if (projectIdRef.current === pid) setTowers(data);
        } else if (target === 'phases') {
          const data = await fetchProjectPhases(token, pid);
          if (projectIdRef.current === pid) setPhases(data);
        } else if (target === 'milestones') {
          const data = await fetchProjectMilestones(token, pid);
          if (projectIdRef.current === pid) setMilestones(data);
        } else if (target === 'plans') {
          const data = await fetchPlanRevisions(token, pid);
          if (projectIdRef.current === pid) setPlans(data);
        }
      } catch (err) {
        if (projectIdRef.current === pid) {
          setLoadError(err instanceof Error ? err.message : 'Tải dữ liệu thất bại');
        }
      }
    },
    [projectId, token],
  );

  useEffect(() => {
    void reload(section);
  }, [reload, section]);

  if (projectId <= 0) {
    return <p className="muted">Chọn dự án hợp lệ.</p>;
  }

  return (
    <div>
      {loadError ? <p className="error">{loadError}</p> : null}
      {actionError ? <p className="error">{actionError}</p> : null}

      {section === 'legal' ? (
        <>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
            {legalDocs.map((d) => (
              <li key={d.id}>
                {d.doc_type} · {d.status}
                {d.expires_on ? ` · hết hạn ${d.expires_on}` : ''}
              </li>
            ))}
          </ul>
          {canLegalApprove ? (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runAction(() =>
                    postProjectLegalDoc(token, projectId, {
                      doc_type: docType,
                      status: 'valid',
                    }),
                  );
                }}
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}
              >
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  disabled={busy}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.55rem 0.75rem',
                    color: 'var(--text)',
                  }}
                >
                  {LEGAL_DOC_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
                  Gắn văn bản
                </button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const reason = gateReason.trim();
                  const override = reason.length >= 10;
                  void runAction(() =>
                    postLegalGate(token, projectId, override ? { override: true, reason } : {}),
                  );
                }}
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
              >
                <input
                  value={gateReason}
                  onChange={(e) => setGateReason(e.target.value)}
                  placeholder="Lý do override (≥10 ký tự, tùy chọn)"
                  disabled={busy}
                  style={{
                    flex: 1,
                    minWidth: 200,
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '0.55rem 0.75rem',
                    color: 'var(--text)',
                  }}
                />
                <button type="submit" className="btn btn-sm" disabled={busy}>
                  Bật cổng
                </button>
              </form>
            </>
          ) : null}
        </>
      ) : null}

      {section === 'towers' ? (
        <>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
            {towers.map((t) => (
              <li key={t.id}>
                {t.code} · {t.name}
              </li>
            ))}
          </ul>
          {canProjectOsEdit ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!towerCode.trim()) return;
                void runAction(() =>
                  postProjectTower(token, projectId, {
                    code: towerCode.trim(),
                    name: towerName.trim() || towerCode.trim(),
                  }),
                ).then(() => {
                  setTowerCode('');
                  setTowerName('');
                });
              }}
              style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
            >
              <input
                value={towerCode}
                onChange={(e) => setTowerCode(e.target.value)}
                placeholder="Mã tòa"
                disabled={busy}
                style={inputStyle}
              />
              <input
                value={towerName}
                onChange={(e) => setTowerName(e.target.value)}
                placeholder="Tên tòa"
                disabled={busy}
                style={inputStyle}
              />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !towerCode.trim()}>
                + Tòa
              </button>
            </form>
          ) : null}
        </>
      ) : null}

      {section === 'phases' ? (
        <>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
            {phases.map((p) => (
              <li key={p.id} style={{ marginBottom: '0.35rem' }}>
                {p.code} · {p.name} · {p.status}
                {canProjectOsEdit ? (
                  <span style={{ marginLeft: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={busy}
                      onClick={() => void runAction(() => postPhaseOpen(token, p.id))}
                    >
                      Mở đợt
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={busy}
                      onClick={() => void runAction(() => postPhaseClose(token, p.id))}
                    >
                      Đóng đợt
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {canProjectOsEdit ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!phaseCode.trim()) return;
                void runAction(() =>
                  postProjectPhase(token, projectId, {
                    code: phaseCode.trim(),
                    name: phaseName.trim() || phaseCode.trim(),
                  }),
                ).then(() => {
                  setPhaseCode('');
                  setPhaseName('');
                });
              }}
              style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
            >
              <input value={phaseCode} onChange={(e) => setPhaseCode(e.target.value)} placeholder="Mã đợt" disabled={busy} style={inputStyle} />
              <input value={phaseName} onChange={(e) => setPhaseName(e.target.value)} placeholder="Tên đợt" disabled={busy} style={inputStyle} />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !phaseCode.trim()}>
                + Đợt
              </button>
            </form>
          ) : null}
        </>
      ) : null}

      {section === 'milestones' ? (
        <>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
            {milestones.map((m) => (
              <li key={m.id} style={{ marginBottom: '0.35rem' }}>
                {m.code} · {m.name} · {m.status}
                {m.target_date ? ` · KH ${m.target_date}` : ''}
                {m.actual_date ? ` · TT ${m.actual_date}` : ''}
                {canProjectOsEdit && m.status !== 'reached' ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ marginLeft: '0.5rem' }}
                    disabled={busy}
                    onClick={() =>
                      void runAction(() =>
                        postMilestoneReach(token, m.id, {
                          actual_date: milestoneDate || new Date().toISOString().slice(0, 10),
                        }),
                      )
                    }
                  >
                    Đạt
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canProjectOsEdit ? (
            <>
              <input
                value={milestoneDate}
                onChange={(e) => setMilestoneDate(e.target.value)}
                placeholder="Ngày đạt (YYYY-MM-DD)"
                disabled={busy}
                style={{ ...inputStyle, marginBottom: '0.5rem', display: 'block' }}
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!milestoneCode.trim()) return;
                  void runAction(() =>
                    postProjectMilestone(token, projectId, {
                      code: milestoneCode.trim(),
                      name: milestoneName.trim() || milestoneCode.trim(),
                      target_date: milestoneDate || undefined,
                    }),
                  ).then(() => {
                    setMilestoneCode('');
                    setMilestoneName('');
                  });
                }}
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
              >
                <input value={milestoneCode} onChange={(e) => setMilestoneCode(e.target.value)} placeholder="Mã mốc" disabled={busy} style={inputStyle} />
                <input value={milestoneName} onChange={(e) => setMilestoneName(e.target.value)} placeholder="Tên mốc" disabled={busy} style={inputStyle} />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !milestoneCode.trim()}>
                  + Mốc
                </button>
              </form>
            </>
          ) : null}
        </>
      ) : null}

      {section === 'plans' ? (
        <>
          <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
            {plans.map((p) => (
              <li key={p.id} style={{ marginBottom: '0.35rem' }}>
                {p.kind} v{p.version} · {p.status}
                {canProjectOsApprove && p.status !== 'approved' ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ marginLeft: '0.5rem' }}
                    disabled={busy}
                    onClick={() =>
                      void runAction(() => postPlanApprove(token, p.id, user.email ?? ''))
                    }
                  >
                    Duyệt
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canProjectOsEdit ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runAction(() => postPlanRevision(token, projectId, { kind: planKind }));
              }}
              style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
            >
              <select
                value={planKind}
                onChange={(e) => setPlanKind(e.target.value)}
                disabled={busy}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.55rem 0.75rem',
                  color: 'var(--text)',
                }}
              >
                <option value="business">business</option>
                <option value="marketing">marketing</option>
                <option value="sales">sales</option>
              </select>
              <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>
                + Bản kế hoạch
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const inputStyle = {
  flex: 1,
  minWidth: 120,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
} as const;
