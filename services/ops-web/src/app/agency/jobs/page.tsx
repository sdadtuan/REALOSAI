'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgencyHubPageShell } from '@/components/agency/AgencyHubPageShell';
import { AgencyReadOnlyBadge, canAgencyWrite } from '@/components/AgencyReadOnlyBadge';
import { fetchAgencyJobs, replayAgencyJob, staffMe, staffRefresh } from '@/lib/api';
import { formatJobTypeCell, jobStatusLabel, jobTypeLabel } from '@/lib/job-labels';
import type { JobRow } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

const STATUS_TABS = ['', 'pending', 'running', 'failed', 'dead', 'done'] as const;

export default function AgencyJobsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState('');

  const canWrite = canAgencyWrite(user);

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

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
      if (!hasCap(me, 'crm_agency', 'view')) return null;
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

  const reload = useCallback(async (access: string, status?: string) => {
    const data = await fetchAgencyJobs(access, status || undefined);
    setJobs(data.jobs);
    setStats(data.stats);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reload(access, filter);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải jobs thất bại');
      }
    })();
  }, [ensureAuth, filter, reload]);

  async function handleReplay(job: JobRow) {
    if (!canWrite || job.status !== 'dead') return;
    if (!window.confirm(`Replay job ${jobTypeLabel(job.job_type)} (${job.id.slice(0, 8)}…)?`)) return;
    const access = getAccessToken();
    if (!access) return;
    setBusyId(job.id);
    setMsg('');
    setError('');
    try {
      await replayAgencyJob(access, job.id);
      setMsg('Job đã được đưa về pending');
      await reload(access, filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replay thất bại');
    } finally {
      setBusyId('');
    }
  }

  const deadCount = stats.dead ?? 0;
  const statsSubtitle = `pending ${stats.pending ?? 0} · running ${stats.running ?? 0} · dead ${deadCount} · failed ${stats.failed ?? 0}`;

  if (!user) {
    return (
      <AgencyHubPageShell
        user={null}
        onLogout={logout}
        title="Pipeline ingest"
        subtitle={statsSubtitle}
        loading
      >
        <span />
      </AgencyHubPageShell>
    );
  }

  return (
    <AgencyHubPageShell
      user={user}
      onLogout={logout}
      title="Pipeline ingest"
      subtitle={statsSubtitle}
      actions={<AgencyReadOnlyBadge user={user} />}
    >
      {deadCount > 0 ? (
        <div className="agency-dlq-banner" role="alert">
          <strong>DLQ:</strong> {deadCount} job dead — cần replay hoặc xử lý thủ công.
        </div>
      ) : null}

      <div className="page-card stack-gap">
        <div className="agency-tabs">
          {STATUS_TABS.map((st) => (
            <button
              key={st || 'all'}
              type="button"
              className={`agency-tab${filter === st ? ' is-active' : ''}`}
              onClick={() => setFilter(st)}
            >
              {st === '' ? 'Tất cả' : jobStatusLabel(st)}
            </button>
          ))}
        </div>

        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Client</th>
                <th>Channel</th>
                <th>Lỗi</th>
                <th>Thời gian</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const typeCell = formatJobTypeCell(j.job_type);
                return (
                  <tr key={j.id}>
                    <td title={typeCell.code}>
                      {typeCell.label}
                      <span className="muted" style={{ display: 'block', fontSize: '0.75rem' }}>
                        {typeCell.code}
                      </span>
                    </td>
                    <td>
                      <span className={`job-status-pill job-status-${j.status}`} title={j.status}>
                        {jobStatusLabel(j.status)}
                      </span>
                    </td>
                    <td>{j.client_code ?? '—'}</td>
                    <td>{j.channel ?? '—'}</td>
                    <td>{j.last_error?.slice(0, 80) ?? '—'}</td>
                    <td>{j.created_at?.slice(0, 16) ?? '—'}</td>
                    <td>
                      {j.status === 'dead' && canWrite ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busyId === j.id}
                          onClick={() => void handleReplay(j)}
                        >
                          Replay
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted agency-empty">
                    Không có job
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AgencyHubPageShell>
  );
}
