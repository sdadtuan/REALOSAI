'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SeoPageShell } from '@/components/seo';
import {
  fetchSeoAuthoritySignals,
  fetchSeoClients,
  importSeoAuthorityCsv,
  staffMe,
  staffRefresh,
  type SeoHubClientRow,
} from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { canViewSeoAuthority, canWriteSeo } from '@/lib/seo/caps';

export default function SeoAuthorityPage() {
  return (
    <Suspense
      fallback={
        <SeoPageShell user={null} onLogout={() => {}} title="Authority Console" loading>
          <span />
        </SeoPageShell>
      }
    >
      <SeoAuthorityContent />
    </Suspense>
  );
}

function SeoAuthorityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [clients, setClients] = useState<SeoHubClientRow[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [signals, setSignals] = useState<Array<Record<string, unknown>>>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) { router.replace('/login'); return null; }
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canViewSeoAuthority(me)) { setError('Không có quyền Authority'); return null; }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) { clearSession(); router.replace('/login'); return null; }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      const me = await staffMe(out.access_token);
      setUser(me);
      return out.access_token;
    }
  }, [router]);

  const loadData = useCallback(async (access: string, cid: number) => {
    setLoading(true);
    try {
      const out = await fetchSeoAuthoritySignals(access, cid);
      setSignals(out.signals);
      setSummary(out.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải authority');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cid = searchParams.get('customer_id');
    if (cid) setCustomerId(cid);
  }, [searchParams]);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      const out = await fetchSeoClients(access);
      setClients(out.clients);
      if (!customerId && out.clients[0]) setCustomerId(String(out.clients[0].customer_id));
    })();
  }, [ensureAuth, customerId]);

  useEffect(() => {
    const cid = Number.parseInt(customerId, 10);
    if (!customerId || Number.isNaN(cid)) return;
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadData(access, cid);
    })();
  }, [customerId, ensureAuth, loadData]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  return (
    <SeoPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      title="Authority Console"
      subtitle="Backlinks, citations, brand mentions — S-11"
    >
      <div className="page-card stack-gap">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <label>
            Client
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ display: 'block', marginTop: 4 }}>
              <option value="">— chọn —</option>
              {clients.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>
              ))}
            </select>
          </label>
          {canWriteSeo(user) && customerId && (
            <>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={() => void (async () => {
                const file = fileRef.current?.files?.[0];
                if (!file) return;
                const access = await ensureAuth();
                if (!access) return;
                const text = await file.text();
                try {
                  const out = await importSeoAuthorityCsv(access, Number(customerId), text);
                  setToast(`Import: ${out.imported} signals, ${out.skipped} skipped`);
                  await loadData(access, Number(customerId));
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Import failed');
                }
              })()} />
              <button type="button" onClick={() => fileRef.current?.click()}>Import CSV</button>
            </>
          )}
        </div>

        {summary.total_signals != null && (
          <div className="channel-hub-summary">
            <div className="summary-card">
              <span className="muted">Total</span>
              <strong>{String(summary.total_signals)}</strong>
            </div>
            <div className="summary-card">
              <span className="muted">Backlinks</span>
              <strong>{String(summary.backlinks_active)}</strong>
            </div>
            <div className="summary-card">
              <span className="muted">Citations</span>
              <strong>{String(summary.citations)}</strong>
            </div>
            <div className="summary-card">
              <span className="muted">Mentions</span>
              <strong>{String(summary.brand_mentions)}</strong>
            </div>
            <div className="summary-card">
              <span className="muted">Avg DR</span>
              <strong>{String(summary.avg_dr)}</strong>
            </div>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        {toast && <p className="muted">{toast}</p>}

        {loading ? <p className="muted">Đang tải…</p> : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Domain</th>
                  <th>Source URL</th>
                  <th>DR</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={String(s.id)}>
                    <td>{String(s.signal_type)}</td>
                    <td>{String(s.source_domain)}</td>
                    <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(s.source_url)}</td>
                    <td>{s.domain_rating != null ? String(s.domain_rating) : '—'}</td>
                    <td>{String(s.status)}</td>
                  </tr>
                ))}
                {!signals.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Chưa có authority signals.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SeoPageShell>
  );
}
