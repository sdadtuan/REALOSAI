'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QuoteBuilderWizard } from '@/components/quote/QuoteBuilderWizard';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import {
  createProposal,
  deleteProposal,
  fetchCustomers,
  fetchLeadPresalesProposalGate,
  fetchProposals,
  generateProposal,
  staffMe,
  staffRefresh,
  type CustomerRow,
  type ProposalRow,
} from '@/lib/api';
import { dealRoomEnabled } from '@/lib/crm/deal-room-flags';
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
import { isOpsDvFeEnabled } from '@/lib/ops-dv-flags';
import { QUOTE_TIER_LABEL } from '@/lib/quote-api';

export function ProposalsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteBuilderEnabled = isOpsDvFeEnabled();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [serviceSlugs, setServiceSlugs] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [prefillDv, setPrefillDv] = useState<string[]>([]);
  const [token, setToken] = useState('');
  const [leadContextId, setLeadContextId] = useState<number | null>(null);
  const [gateRedirecting, setGateRedirecting] = useState(false);

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
      if (!hasCap(me, 'crm_board', 'view')) {
        setError('Không có quyền đề xuất');
        return null;
      }
      setToken(access);
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
      setToken(access);
      return access;
    }
  }, [router]);

  const reloadProposals = useCallback(async (access: string, cid: string) => {
    if (!cid) return;
    setProposals(await fetchProposals(access, Number(cid)));
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        const data = await fetchCustomers(access, { limit: 200 });
        setCustomers(data);
        const prefillCustomer = searchParams.get('customer_id') ?? '';
        const prefillSlugs = searchParams.get('service_slugs') ?? '';
        const prefillNotes = searchParams.get('notes') ?? '';
        if (prefillCustomer) setCustomerId(prefillCustomer);
        else if (data[0]) setCustomerId(String(data[0].id));
        if (prefillSlugs) setServiceSlugs(prefillSlugs);
        if (prefillNotes) setNotes(prefillNotes);
        const leadIdRaw = searchParams.get('lead_id');
        const leadId = leadIdRaw ? Number(leadIdRaw) : 0;
        if (leadId > 0) {
          setLeadContextId(leadId);
          if (dealRoomEnabled()) {
            try {
              const gateResp = await fetchLeadPresalesProposalGate(access, leadId);
              if (!gateResp.gate.ok) {
                setGateRedirecting(true);
                router.replace(`/crm/leads/${leadId}/deal-room?gate_blocked=1`);
                return;
              }
            } catch {
              // fall through — proposals page still usable without gate API
            }
          }
        }
        if (quoteBuilderEnabled && searchParams.get('wizard') === '1') setShowWizard(true);
        setPrefillDv(
          (searchParams.get('prefill_dv') ?? '')
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải khách hàng thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, quoteBuilderEnabled, router, searchParams]);

  useEffect(() => {
    void (async () => {
      const access = getAccessToken();
      if (!access || !customerId) return;
      setLoading(true);
      setError('');
      try {
        await reloadProposals(access, customerId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải đề xuất thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId, reloadProposals]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !customerId) return;
    const slugs = serviceSlugs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!slugs.length) return;
    setSaving(true);
    setError('');
    try {
      await createProposal(access, {
        customer_id: Number(customerId),
        lead_id: leadContextId ?? undefined,
        service_slugs: slugs,
        notes: notes.trim() || undefined,
      });
      setServiceSlugs('');
      setNotes('');
      await reloadProposals(access, customerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo đề xuất thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function onGenerate(id: number) {
    const access = getAccessToken();
    if (!access) return;
    setError('');
    try {
      await generateProposal(access, id);
      await reloadProposals(access, customerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate AI chưa sẵn sàng');
    }
  }

  async function onDelete(id: number) {
    const access = getAccessToken();
    if (!access || !customerId) return;
    if (!window.confirm('Xóa đề xuất này?')) return;
    setError('');
    try {
      await deleteProposal(access, id);
      await reloadProposals(access, customerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa thất bại');
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user || gateRedirecting) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      width="default"
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Bán hàng', href: '/crm/proposals' },
        { label: 'Báo giá' },
      ]}
    >
      <HubPageLayout
        title={quoteBuilderEnabled ? 'Quote Builder (3 gói DV)' : 'Đề xuất dịch vụ'}
        subtitle={`${proposals.length} đề xuất`}
      >
        <div style={{ marginBottom: '0.25rem' }}>
          <label className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Khách hàng
          </label>
          <select
            className="kpi-select"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            style={{ width: '100%', maxWidth: 420 }}
            disabled={showWizard}
          >
            {customers.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name} {c.company ? `· ${c.company}` : ''}
              </option>
            ))}
          </select>
        </div>

        {quoteBuilderEnabled && hasCap(user, 'crm_board', 'edit') ? (
          <div style={{ marginBottom: '1rem' }}>
            {!showWizard ? (
              <button type="button" className="btn btn-sm" onClick={() => setShowWizard(true)}>
                + Quote Builder (DV + 3 gói)
              </button>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowWizard(false)}>
                ← Danh sách đề xuất
              </button>
            )}
          </div>
        ) : null}

        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {showWizard && token ? (
          <QuoteBuilderWizard
            token={token}
            user={user}
            customers={customers}
            initialCustomerId={customerId}
            initialSelectedDv={prefillDv}
            onDone={async () => {
              setShowWizard(false);
              const access = getAccessToken();
              if (access && customerId) await reloadProposals(access, customerId);
            }}
          />
        ) : (
          <>
            <ul style={{ margin: '0 0 1rem', paddingLeft: '1.1rem' }}>
              {proposals.map((p) => (
                <li key={p.id} style={{ marginBottom: '0.5rem' }}>
                  #{p.id}
                  {'status' in p && p.status ? ` · ${String(p.status)}` : ''} ·{' '}
                  {(p.service_slugs ?? []).join(', ') || 'quote lines'} ·{' '}
                  {p.total_vnd.toLocaleString('vi-VN')} VND
                  {hasCap(user, 'crm_board', 'edit') ? (
                    <>
                      {' '}
                      <button type="button" className="btn btn-sm" onClick={() => void onGenerate(p.id)}>
                        AI
                      </button>{' '}
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onDelete(p.id)}>
                        Xóa
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            {proposals.length === 0 && !loading ? <p className="muted">Chưa có đề xuất.</p> : null}
            {!quoteBuilderEnabled && hasCap(user, 'crm_board', 'edit') ? (
              <form onSubmit={(e) => void onCreate(e)} style={{ display: 'grid', gap: '0.5rem', maxWidth: 520 }}>
                <input
                  className="kpi-input"
                  value={serviceSlugs}
                  onChange={(e) => setServiceSlugs(e.target.value)}
                  placeholder="service slugs (vd: seo, ads)"
                  disabled={saving}
                />
                <textarea
                  className="kpi-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú"
                  rows={2}
                  disabled={saving}
                />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={saving || !serviceSlugs.trim()}>
                  + Đề xuất (legacy)
                </button>
              </form>
            ) : null}
            {quoteBuilderEnabled ? (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                Gói: {Object.values(QUOTE_TIER_LABEL).join(' · ')} — giá tham khảo từ catalog DV.
              </p>
            ) : null}
          </>
        )}
      </HubPageLayout>
    </StaffPageShell>
  );
}
