'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmailPageShell } from '@/components/email';
import { FilterBar, FilterBarActions } from '@/components/layout';
import {
  createEmailJourney,
  fetchEmailJourneys,
  staffMe,
  staffRefresh,
  type EmailJourneyRow,
} from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function EmailJourneysPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [journeys, setJourneys] = useState<EmailJourneyRow[]>([]);
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_email_mkt', 'view') && !hasCap(me, 'crm_agency', 'view')) {
        setError('Không có quyền');
        return null;
      }
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
      setUser(await staffMe(access));
      return access;
    }
  }, [router]);

  const load = useCallback(
    async (access: string) => {
      setLoading(true);
      try {
        const data = await fetchEmailJourneys(access, {
          client_id: clientId.trim() || undefined,
          limit: 100,
        });
        setJourneys(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải journeys thất bại');
      } finally {
        setLoading(false);
      }
    },
    [clientId],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await load(access);
    })();
  }, [ensureAuth, load]);

  async function create() {
    const access = getAccessToken();
    if (!access || !clientId.trim() || !name.trim()) return;
    setError('');
    try {
      const row = await createEmailJourney(access, {
        client_id: clientId.trim(),
        name: name.trim(),
      });
      setName('');
      router.push(`/email/journeys/${row.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo journey thất bại');
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <EmailPageShell user={null} onLogout={logout} title="Journeys" loading>
        <span />
      </EmailPageShell>
    );
  }

  const canWrite = hasCap(user, 'crm_email_mkt', 'write') || hasCap(user, 'crm_agency', 'create');

  return (
    <EmailPageShell
      user={user}
      onLogout={logout}
      title="Journeys"
      subtitle="EM-3 E-10 — Journey builder"
    >
      <div className="page-card stack-gap">
        <FilterBar>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client UUID" style={{ width: 280 }} />
          <FilterBarActions>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { const a = getAccessToken(); if (a) void load(a); }}>Làm mới</button>
          </FilterBarActions>
        </FilterBar>
        {error ? <p className="error">{error}</p> : null}
        {canWrite ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên journey" />
            <button type="button" className="btn btn-sm" onClick={() => void create()}>+ Tạo journey</button>
          </div>
        ) : null}
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Client</th><th>Trigger</th><th>Enrolled</th><th>Status</th><th /></tr></thead>
            <tbody>
              {journeys.map((j) => (
                <tr key={j.id}>
                  <td>{j.name}</td>
                  <td>{j.client_name}</td>
                  <td>{j.trigger_type}</td>
                  <td>{j.enrolled_count}</td>
                  <td>{j.status}</td>
                  <td><Link href={`/email/journeys/${j.id}`} className="btn btn-sm">Canvas</Link></td>
                </tr>
              ))}
              {!loading && journeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">Chưa có journey.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </EmailPageShell>
  );
}
