'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmailPageShell } from '@/components/email';
import { FilterBar, FilterBarActions } from '@/components/layout';
import {
  createEmailTemplate,
  fetchEmailTemplates,
  staffMe,
  staffRefresh,
  type EmailTemplateRow,
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

const DEFAULT_HTML =
  '<p>Hello {{first_name}},</p><p>Your update here.</p><p><a href="{{unsubscribe_url}}">Unsubscribe</a></p>';

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('Newsletter');
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
        const data = await fetchEmailTemplates(access, {
          client_id: clientId.trim() || undefined,
          limit: 100,
        });
        setTemplates(data.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải templates thất bại');
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
    if (!access || !clientId.trim() || !name.trim() || !subject.trim()) return;
    setError('');
    try {
      const row = await createEmailTemplate(access, {
        client_id: clientId.trim(),
        name: name.trim(),
        subject_template: subject.trim(),
        html_body: DEFAULT_HTML,
      });
      setName('');
      router.push(`/email/templates/${row.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo template thất bại');
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <EmailPageShell user={null} onLogout={logout} title="Templates" loading>
        <span />
      </EmailPageShell>
    );
  }

  const canWrite = hasCap(user, 'crm_email_mkt', 'write') || hasCap(user, 'crm_agency', 'create');

  return (
    <EmailPageShell
      user={user}
      onLogout={logout}
      title="Templates"
      subtitle="EM-2 E-08 — Template library"
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên template" />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={{ minWidth: 200 }} />
            <button type="button" className="btn btn-sm" onClick={() => void create()}>+ Tạo template</button>
          </div>
        ) : null}
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Client</th><th>Subject</th><th>Version</th><th>Status</th><th /></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.client_name}</td>
                  <td>{t.subject_template}</td>
                  <td>v{t.version}</td>
                  <td>{t.status}</td>
                  <td><Link href={`/email/templates/${t.id}`} className="btn btn-sm">Mở</Link></td>
                </tr>
              ))}
              {!loading && templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">Chưa có template.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </EmailPageShell>
  );
}
