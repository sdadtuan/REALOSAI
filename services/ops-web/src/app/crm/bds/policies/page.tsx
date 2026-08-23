'use client';

import { useEffect, useRef, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  fetchPriceLists,
  fetchProjectPhases,
  fetchProjectPolicies,
  postPolicyActivate,
  postPolicyArchive,
  postPolicyQuote,
  postPriceList,
  postPriceListItem,
  postProjectPolicy,
} from '@/lib/bds/api';
import type { BdsPhase, BdsPolicy, BdsPriceList } from '@/lib/bds/types';
import { policyActivateRole } from '@/lib/bds/actor-role';
import { BdsProjectField } from '@/lib/bds/BdsProjectField';
import { readBdsProjectId } from '@/lib/bds/project-picker';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';
import { w2ActionCopy } from '@/lib/bds/w2-copy';

export default function BdsPoliciesPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_policies', action: 'view' },
  ]);
  const canCreate = hasCap(user, 'bds_policies', 'create') || hasCap(user, 'bds_policies', 'edit');
  const canApprove = hasCap(user, 'bds_policies', 'approve');

  const [projectId, setProjectId] = useState(() => readBdsProjectId());
  const projectIdRef = useRef(projectId);
  const [policies, setPolicies] = useState<BdsPolicy[]>([]);
  const [priceLists, setPriceLists] = useState<BdsPriceList[]>([]);
  const [phases, setPhases] = useState<BdsPhase[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [hdmbMin, setHdmbMin] = useState('');
  const [discountCap, setDiscountCap] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [itemUnitCode, setItemUnitCode] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [activatePhaseId, setActivatePhaseId] = useState('');
  const [activateListId, setActivateListId] = useState('');
  const [quoteListPrice, setQuoteListPrice] = useState('');
  const [quoteDiscount, setQuoteDiscount] = useState('');
  const [quoteResult, setQuoteResult] = useState('');

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const onProjectChange = (id: number) => {
    projectIdRef.current = id;
    setPolicies([]);
    setPriceLists([]);
    setPhases([]);
    setLoadError('');
    setActionError('');
    setProjectId(id);
  };

  const reload = async (accessToken: string, id: number) => {
    if (id <= 0) {
      if (projectIdRef.current === id) {
        setPolicies([]);
        setPriceLists([]);
        setPhases([]);
      }
      return;
    }
    const pid = id;
    try {
      const [pol, lists, ph] = await Promise.all([
        fetchProjectPolicies(accessToken, pid),
        fetchPriceLists(accessToken, pid),
        fetchProjectPhases(accessToken, pid),
      ]);
      if (projectIdRef.current === pid) {
        setPolicies(pol);
        setPriceLists(lists);
        setPhases(ph);
        setLoadError('');
      }
    } catch (err) {
      if (projectIdRef.current === pid) {
        setLoadError(err instanceof Error ? err.message : 'Tải CSBH thất bại');
      }
    }
  };

  useEffect(() => {
    if (!token || projectId === 0) return;
    void reload(token, projectId);
  }, [token, projectId]);

  const runAction = async (fn: () => Promise<unknown>) => {
    if (!token) return;
    setActionError('');
    setBusy(true);
    try {
      await fn();
      await reload(token, projectId);
    } catch (err) {
      setActionError(w2ActionCopy(err instanceof Error ? err.message : 'Thao tác thất bại'));
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout title="Giá / CSBH" subtitle="Chính sách bán hàng">
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="error">{loadError}</p> : null}
        {actionError ? <p className="error">{actionError}</p> : null}

        <BdsProjectField token={token ?? ''} value={projectId} onChange={onProjectChange} />

        {projectId === 0 ? (
          <p className="muted">Chọn dự án.</p>
        ) : (
          <>
            <h3 style={{ marginTop: '1rem' }}>CSBH</h3>
            <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
              {policies.map((p) => (
                <li key={p.id}>
                  {p.code} · {p.name} · {p.status}
                  {p.hdmb_min_paid_pct != null ? ` · HĐMB ${p.hdmb_min_paid_pct}%` : ''}
                </li>
              ))}
            </ul>

            {canCreate ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!code.trim()) return;
                  void runAction(() =>
                    postProjectPolicy(token!, projectId, {
                      code: code.trim(),
                      name: name.trim() || code.trim(),
                      hdmb_min_paid_pct: hdmbMin ? Number(hdmbMin) : undefined,
                      discount_cap_pct: discountCap ? Number(discountCap) : undefined,
                    }),
                  );
                }}
                style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}
              >
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã CSBH" disabled={busy} style={inputStyle} />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên" disabled={busy} style={inputStyle} />
                <input value={hdmbMin} onChange={(e) => setHdmbMin(e.target.value)} placeholder="% HĐMB" disabled={busy} style={inputStyle} />
                <input value={discountCap} onChange={(e) => setDiscountCap(e.target.value)} placeholder="Trần CK %" disabled={busy} style={inputStyle} />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !code.trim()}>
                  + CSBH draft
                </button>
              </form>
            ) : null}

            <h3>Bảng giá</h3>
            <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
              {priceLists.map((pl) => (
                <li key={pl.id}>
                  {pl.version_code} · #{pl.id}
                  {pl.name ? ` · ${pl.name}` : ''}
                </li>
              ))}
            </ul>
            {canCreate ? (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!versionCode.trim()) return;
                    void runAction(() =>
                      postPriceList(token!, projectId, { version_code: versionCode.trim() }),
                    );
                  }}
                  style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}
                >
                  <input value={versionCode} onChange={(e) => setVersionCode(e.target.value)} placeholder="version_code" disabled={busy} style={inputStyle} />
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !versionCode.trim()}>
                    + Bảng giá
                  </button>
                </form>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const listId = selectedListId ?? priceLists[0]?.id;
                    if (!listId || !itemUnitCode.trim()) return;
                    void runAction(() =>
                      postPriceListItem(token!, listId, {
                        unit_code: itemUnitCode.trim(),
                        list_price_vnd: itemPrice ? Number(itemPrice) : undefined,
                      }),
                    );
                  }}
                  style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}
                >
                  <select
                    value={selectedListId ?? priceLists[0]?.id ?? ''}
                    onChange={(e) => setSelectedListId(Number(e.target.value))}
                    disabled={busy || priceLists.length === 0}
                    style={selectStyle}
                  >
                    {priceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.version_code}
                      </option>
                    ))}
                  </select>
                  <input value={itemUnitCode} onChange={(e) => setItemUnitCode(e.target.value)} placeholder="unit_code" disabled={busy} style={inputStyle} />
                  <input value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="list_price_vnd" disabled={busy} style={inputStyle} />
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !itemUnitCode.trim() || priceLists.length === 0}>
                    + Dòng giá
                  </button>
                </form>
              </>
            ) : null}

            <h3>Báo giá thử</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const pid = selectedPolicyId || policies[0]?.id;
                if (!pid) return;
                void (async () => {
                  setActionError('');
                  setQuoteResult('');
                  setBusy(true);
                  try {
                    const out = await postPolicyQuote(token!, pid, {
                      list_price_vnd: Number(quoteListPrice),
                      discount_pct: Number(quoteDiscount),
                    });
                    setQuoteResult(JSON.stringify(out));
                  } catch (err) {
                    setQuoteResult(w2ActionCopy(err instanceof Error ? err.message : 'Quote thất bại'));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
              style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}
            >
              <select
                value={selectedPolicyId || policies[0]?.id || ''}
                onChange={(e) => setSelectedPolicyId(e.target.value)}
                disabled={busy || policies.length === 0}
                style={selectStyle}
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
              </select>
              <input value={quoteListPrice} onChange={(e) => setQuoteListPrice(e.target.value)} placeholder="list_price_vnd" disabled={busy} style={inputStyle} />
              <input value={quoteDiscount} onChange={(e) => setQuoteDiscount(e.target.value)} placeholder="discount_pct" disabled={busy} style={inputStyle} />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || policies.length === 0}>
                Quote
              </button>
            </form>
            {quoteResult ? <pre style={preStyle}>{quoteResult}</pre> : null}

            {canApprove ? (
              <>
                <h3>Kích hoạt / Lưu trữ</h3>
                <p className="muted">Activate: «Một giá khóa. Kênh không cộng phí.»</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const pid = selectedPolicyId || policies.find((p) => p.status === 'draft')?.id;
                    if (!pid || !activatePhaseId || !activateListId) return;
                    if (!window.confirm('Một giá khóa. Kênh không cộng phí.')) return;
                    void runAction(() =>
                      postPolicyActivate(token!, pid, {
                        phase_id: activatePhaseId,
                        price_list_id: Number(activateListId),
                        actor_role: policyActivateRole(),
                        activated_by: user?.email ?? '',
                      }),
                    );
                  }}
                  style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}
                >
                  <select value={activatePhaseId} onChange={(e) => setActivatePhaseId(e.target.value)} disabled={busy} style={selectStyle}>
                    <option value="">Đợt</option>
                    {phases.map((ph) => (
                      <option key={ph.id} value={ph.id}>
                        {ph.code}
                      </option>
                    ))}
                  </select>
                  <select value={activateListId} onChange={(e) => setActivateListId(e.target.value)} disabled={busy} style={selectStyle}>
                    <option value="">Bảng giá</option>
                    {priceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.version_code}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-sm" disabled={busy || !activatePhaseId || !activateListId}>
                    Kích hoạt
                  </button>
                </form>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  disabled={busy || !(selectedPolicyId || policies[0]?.id)}
                  onClick={() => {
                    const pid = selectedPolicyId || policies[0]?.id;
                    if (!pid) return;
                    void runAction(() =>
                      postPolicyArchive(token!, pid, { actor_role: policyActivateRole() }),
                    );
                  }}
                >
                  Lưu trữ
                </button>
              </>
            ) : null}
          </>
        )}
      </HubPageLayout>
    </StaffPageShell>
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

const preStyle = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem',
  fontSize: '0.85rem',
  overflow: 'auto',
} as const;
