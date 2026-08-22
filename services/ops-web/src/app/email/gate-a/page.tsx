'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EmailPageShell } from '@/components/email';
import {
  fetchEmailGateAReadiness,
  fetchEmailGateASignoffTemplate,
  fetchEmailGateAStatus,
  staffMe,
  staffRefresh,
} from '@/lib/api';
import { canViewEmailGateA } from '@/lib/email/caps';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  type StoredStaffUser,
} from '@/lib/auth';

type GateAReadiness = {
  ok?: boolean;
  phase?: string;
  gate?: string;
  generated_at?: string;
  flags?: Record<string, boolean>;
  staged_steps?: Array<{ id: string; label: string; enabled: boolean; env_keys: string[] }>;
  ops_web_routes?: string[];
  soak?: Record<string, unknown>;
  artifacts?: Record<string, string>;
  qa_checklist?: Array<{ id: string; label: string; status: string }>;
  nginx_redirect?: string;
  notes?: string[];
};

export default function EmailGateAPage() {
  return (
    <Suspense
      fallback={
        <EmailPageShell user={null} onLogout={() => {}} title="Gate A" loading>
          <span />
        </EmailPageShell>
      }
    >
      <EmailGateAContent />
    </Suspense>
  );
}

function EmailGateAContent() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [status, setStatus] = useState<GateAReadiness>({});
  const [readiness, setReadiness] = useState<GateAReadiness>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

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
      if (!canViewEmailGateA(me)) {
        setError('Không có quyền Email Gate A');
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
      return out.access_token;
    }
  }, [router]);

  const load = useCallback(async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const [st, ready] = await Promise.all([
        fetchEmailGateAStatus(token),
        fetchEmailGateAReadiness(token),
      ]);
      setStatus(st as GateAReadiness);
      setReadiness(ready as GateAReadiness);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được Gate A status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const token = await ensureAuth();
      if (token) await load(token);
      else setLoading(false);
    })();
  }, [ensureAuth, load]);

  const onLogout = () => {
    clearSession();
    router.replace('/login');
  };

  const downloadSignoff = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const out = await fetchEmailGateASignoffTemplate(token);
      const blob = new Blob([JSON.stringify(out.template ?? out, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'em5-email-pilot-signoff.template.json';
      a.click();
      URL.revokeObjectURL(url);
      setToast('Đã tải sign-off template');
    } catch {
      setToast('Không tải được sign-off template');
    }
  };

  const ready = readiness.ok ?? status.ok;
  const soak = (readiness.soak ?? status.soak ?? {}) as Record<string, unknown>;
  const staged = readiness.staged_steps ?? status.staged_steps ?? [];
  const notes = readiness.notes ?? status.notes ?? [];

  if (!user) {
    return (
      <EmailPageShell user={null} onLogout={onLogout} title="Gate A" loading>
        <span />
      </EmailPageShell>
    );
  }

  return (
    <EmailPageShell
      user={user}
      onLogout={onLogout}
      title="Gate A — Prod pilot Email Marketing"
      subtitle="EM-5 · Staged cutover B1→B4 · soak ≥7 ngày · ESP pilot"
      showModuleNav={false}
      actions={
        <>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void downloadSignoff()}>
            Tải sign-off template
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const token = getAccessToken();
              if (token) void load(token);
            }}
          >
            Làm mới
          </button>
        </>
      }
    >
      {toast ? <p className="toast">{toast}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải…</p> : null}

      {!loading && !error ? (
        <>
          <div className="page-card stack-gap">
            <h3 style={{ marginTop: 0 }}>Readiness</h3>
            <p>
              Trạng thái:{' '}
              <strong className={ready ? 'text-ok' : 'text-warn'}>{ready ? 'Sẵn sàng' : 'Chưa đạt'}</strong>
              {readiness.generated_at ? ` · ${readiness.generated_at}` : null}
            </p>
            <ul className="muted" style={{ marginTop: '0.5rem' }}>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          <div className="page-card stack-gap">
            <h3 style={{ marginTop: 0 }}>Staged cutover flags</h3>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bước</th>
                    <th>Trạng thái</th>
                    <th>Env keys</th>
                  </tr>
                </thead>
                <tbody>
                  {staged.map((step) => (
                    <tr key={step.id}>
                      <td>{step.label}</td>
                      <td>{step.enabled ? '✓ ON' : '— OFF'}</td>
                      <td><code>{step.env_keys.join(', ')}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="page-card stack-gap">
            <h3 style={{ marginTop: 0 }}>Soak evidence</h3>
            <p className="muted">
              Required days: {String(soak.required_days ?? 7)} · Samples: {String(soak.sample_count ?? 0)}
              {' · '}Span days: {String(soak.span_days ?? '—')}
              {' · '}Failures: {String(soak.failure_count ?? 0)}
              {soak.skipped ? ' · (skipped in dev)' : null}
            </p>
            {soak.log_path ? <p><code>{String(soak.log_path)}</code></p> : null}
          </div>

          <div className="page-card stack-gap">
            <h3 style={{ marginTop: 0 }}>QA handoff §13</h3>
            <ul>
              {(readiness.qa_checklist ?? []).map((item) => (
                <li key={item.id}>
                  {item.label}
                  <span className="muted"> — {item.status}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="page-card stack-gap">
            <h3 style={{ marginTop: 0 }}>ops-web routes</h3>
            <p className="muted">Staff console — bookmark cũ /crm/email redirect về /email/hub</p>
            <ul style={{ columns: 2 }}>
              {(readiness.ops_web_routes ?? []).map((route) => (
                <li key={route}>
                  <Link href={route} className="nav-link">{route}</Link>
                </li>
              ))}
            </ul>
            {readiness.nginx_redirect ? (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                Nginx: <code>{readiness.nginx_redirect}</code>
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </EmailPageShell>
  );
}
