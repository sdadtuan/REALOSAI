'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DetailPageLayout, StaffPageShell } from '@/components/layout';
import {
  fetchB2bProject,
  fetchB2bProjectChannels,
  fetchB2bProjectPages,
  fetchB2bProjectStaff,
  type B2bProjectChannelRow,
  type B2bProjectDetail,
  type B2bProjectPageRow,
  type B2bProjectStaffRow,
} from '@/lib/b2b-projects-api';
import { staffMe, staffRefresh } from '@/lib/api';
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

type DetailTab = 'overview' | 'channels' | 'staff' | 'sla' | 'commission';

const TAB_LABELS: Record<DetailTab, string> = {
  overview: 'Tổng quan',
  channels: 'Kênh',
  staff: 'Nhân viên',
  sla: 'SLA & gọi',
  commission: 'Hoa hồng',
};

export default function CrmB2bProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [project, setProject] = useState<B2bProjectDetail | null>(null);
  const [pages, setPages] = useState<B2bProjectPageRow[]>([]);
  const [channels, setChannels] = useState<B2bProjectChannelRow[]>([]);
  const [staff, setStaff] = useState<B2bProjectStaffRow[]>([]);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (!hasCap(me, 'crm_b2b_projects', 'view')) {
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
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        const [detail, pageRows, channelRows, staffRows] = await Promise.all([
          fetchB2bProject(access, projectId),
          fetchB2bProjectPages(access, projectId),
          fetchB2bProjectChannels(access, projectId),
          fetchB2bProjectStaff(access, projectId),
        ]);
        setProject(detail);
        setPages(pageRows);
        setChannels(channelRows);
        setStaff(staffRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dự án thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, projectId]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const commission = project?.commission_json;
  const sla = project?.sla_json ?? {};

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Dự án PTT', href: '/crm/b2b-projects' },
        { label: project?.name ?? projectId },
      ]}
    >
      <DetailPageLayout
        title={project?.name ?? 'Dự án PTT'}
        subtitle={project ? `${project.code} · ${project.status}` : undefined}
        backHref="/crm/b2b-projects"
        backLabel="← Danh sách"
      >
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {project ? (
          <>
            <div className="lead-b2b-subtabs" role="tablist" aria-label="Chi tiết dự án PTT">
              {(Object.keys(TAB_LABELS) as DetailTab[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={tab === key ? 'is-active' : ''}
                  onClick={() => setTab(key)}
                >
                  {TAB_LABELS[key]}
                </button>
              ))}
            </div>

            {tab === 'overview' ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <p className="muted">Chủ quản: PTT (chỉ đọc trên UI v1)</p>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.35rem 1rem' }}>
                  <dt>Mã webhook</dt>
                  <dd>
                    <code>{project.code}</code>
                  </dd>
                  <dt>Trạng thái</dt>
                  <dd>{project.status}</dd>
                  <dt>Ingest thủ công</dt>
                  <dd>{project.manual_ingest_enabled ? 'Bật' : 'Tắt'}</dd>
                  <dt>AI gọi</dt>
                  <dd>{project.ai_call_enabled ? 'Bật' : 'Tắt'}</dd>
                </dl>
                <p className="muted">
                  Webhook: <code>/api/v1/webhooks/meta/{project.code}</code> ·{' '}
                  <code>/api/v1/webhooks/zalo/{project.code}</code>
                </p>
              </div>
            ) : null}

            {tab === 'channels' ? (
              <div style={{ display: 'grid', gap: '1rem' }}>
                <section>
                  <h3 style={{ marginTop: 0 }}>Facebook pages & forms</h3>
                  {pages.length === 0 ? (
                    <p className="muted">Chưa cấu hình page/form.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {pages.map((p) => (
                        <li key={p.id}>
                          <strong>{p.page_id}</strong>
                          {p.name ? ` — ${p.name}` : ''}{' '}
                          <span className="muted">{p.active ? 'active' : 'inactive'}</span>
                          {(p.forms ?? []).length ? (
                            <ul>
                              {(p.forms ?? []).map((f) => (
                                <li key={f.form_id}>
                                  form {f.form_id}
                                  {f.name ? ` (${f.name})` : ''}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section>
                  <h3>Zalo / Webform / API</h3>
                  {channels.length === 0 ? (
                    <p className="muted">Chưa cấu hình kênh.</p>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {channels.map((c) => (
                        <li key={c.id}>
                          {c.channel_type}: <code>{c.external_key}</code>
                          {c.label ? ` — ${c.label}` : ''}{' '}
                          <span className="muted">{c.active ? 'active' : 'inactive'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {hasCap(user, 'crm_b2b_projects', 'manage') ? (
                  <p className="muted">Chỉnh sửa kênh qua API PUT /pages · /channels (UI form P3).</p>
                ) : null}
              </div>
            ) : null}

            {tab === 'staff' ? (
              <div>
                {staff.length === 0 ? (
                  <p className="muted">Chưa gán nhân viên nhận lead.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Staff ID</th>
                        <th>Nhận lead</th>
                        <th>Cấp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s) => (
                        <tr key={s.staff_id}>
                          <td>
                            <Link href={`/crm/staff/${s.staff_id}`} className="nav-link">
                              {s.staff_id}
                            </Link>
                          </td>
                          <td>{s.assign_enabled ? 'Có' : 'Không'}</td>
                          <td>{s.sales_level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : null}

            {tab === 'sla' ? (
              <div>
                <pre
                  style={{
                    margin: 0,
                    padding: '0.75rem',
                    background: 'var(--surface-muted, #f4f4f5)',
                    borderRadius: 6,
                    overflow: 'auto',
                    fontSize: '0.85rem',
                  }}
                >
                  {JSON.stringify(sla, null, 2) || '{}'}
                </pre>
                <p className="muted" style={{ marginTop: '0.75rem' }}>
                  Giờ làm việc:{' '}
                  <code>{JSON.stringify(project.business_hours_json ?? {})}</code>
                </p>
              </div>
            ) : null}

            {tab === 'commission' ? (
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0.35rem 1rem' }}>
                <dt>First-touch</dt>
                <dd>{commission?.first_touch_pct ?? 30}%</dd>
                <dt>Closer</dt>
                <dd>{commission?.closer_pct ?? 70}%</dd>
              </dl>
            ) : null}
          </>
        ) : null}
      </DetailPageLayout>
    </StaffPageShell>
  );
}
