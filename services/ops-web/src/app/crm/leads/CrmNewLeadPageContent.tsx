'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DetailPageLayout, StaffPageShell } from '@/components/layout';
import {
  ApiError,
  createLead,
  fetchAgencyClients,
  fetchCrmStaffList,
  fetchLeadLookupOptions,
  staffMe,
  staffRefresh,
  type AgencyClient,
  type CrmLeadLookupOption,
  type CrmStaffRow,
} from '@/lib/api';
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
import {
  leadsListHref,
  type CrmLeadsFlowScope,
} from '@/lib/crm/lead-flow-routes';
import { statusOptionsForFlowKind } from '@/lib/crm/lead-flow-kind';
import { fetchB2bProjects, type B2bProjectListItem } from '@/lib/b2b-projects-api';

const SPA_STATUS_OPTIONS = [
  { value: 'moi', label: 'Mới' },
  { value: 'da_lien_he', label: 'Đã liên hệ' },
  { value: 'dang_tu_van', label: 'Đang tư vấn' },
  { value: 'hen_gap', label: 'Hẹn gặp' },
  { value: 'chot', label: 'Chốt' },
  { value: 'lost', label: 'Lost' },
] as const;

function flowScopeFromPathname(pathname: string): CrmLeadsFlowScope {
  if (pathname.startsWith('/crm/operational/leads') || pathname.startsWith('/crm/spa/leads')) {
    return 'spa_operational';
  }
  if (pathname.startsWith('/crm/b2b/leads')) return 'b2b_prospect';
  return 'all';
}

export function CrmNewLeadPageContent({
  flowScope: flowScopeProp,
}: {
  flowScope?: CrmLeadsFlowScope;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const flowScope = flowScopeProp ?? flowScopeFromPathname(pathname);
  const isOperationalFlow = flowScope === 'spa_operational';
  const isB2bFlow = flowScope === 'b2b_prospect';
  const listHref = leadsListHref(flowScope);
  const pageTitle = isOperationalFlow
    ? 'Tạo lead CSKH vận hành'
    : isB2bFlow
      ? 'Tạo lead B2B'
      : 'Tạo lead thủ công';
  const statusOptions = useMemo(() => {
    if (isOperationalFlow) return SPA_STATUS_OPTIONS;
    if (isB2bFlow) {
      return statusOptionsForFlowKind('b2b_prospect').map((value) => ({
        value,
        label: value,
      }));
    }
    return SPA_STATUS_OPTIONS;
  }, [isB2bFlow, isOperationalFlow]);
  const [presetClientId, setPresetClientId] = useState('');
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [staffOptions, setStaffOptions] = useState<CrmStaffRow[]>([]);
  const [sourceOptions, setSourceOptions] = useState<CrmLeadLookupOption[]>([]);
  const [channelOptions, setChannelOptions] = useState<CrmLeadLookupOption[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [clientId, setClientId] = useState('');
  const [source, setSource] = useState('manual');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('moi');
  const [ownerId, setOwnerId] = useState('');
  const [b2bProjectId, setB2bProjectId] = useState('');
  const [b2bProjects, setB2bProjects] = useState<B2bProjectListItem[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canCreate = useMemo(() => hasCap(user, 'crm_leads', 'edit'), [user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const clientId = new URLSearchParams(window.location.search).get('client_id') ?? '';
    setPresetClientId(clientId);
  }, []);

  useEffect(() => {
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    setToken(access);
    const cached = getStoredUser();
    if (cached) setUser(cached);

    void (async () => {
      let currentToken = access;
      try {
        const me = await staffMe(currentToken);
        setUser(me);
        updateStoredUser(me);
        if (!hasCap(me, 'crm_leads', 'edit')) {
          setError('Không có quyền tạo lead');
          return;
        }
        setOwnerId((prev) => prev || (me.id ? String(me.id) : ''));
      } catch {
        const refresh = getRefreshToken();
        if (!refresh) {
          router.replace('/login');
          return;
        }
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        currentToken = out.access_token;
        setToken(currentToken);
        const me = await staffMe(currentToken);
        setUser(me);
        updateStoredUser(me);
        setOwnerId((prev) => prev || (me.id ? String(me.id) : ''));
      }

      const [clientOut, staffOut, sourceOut, channelOut] = await Promise.all([
        fetchAgencyClients(currentToken).catch(() => ({ clients: [] as AgencyClient[] })),
        fetchCrmStaffList(currentToken).catch(() => ({ staff: [] as CrmStaffRow[], summary: {} })),
        fetchLeadLookupOptions(currentToken, 'source').catch(() => ({ options: [] as CrmLeadLookupOption[] })),
        fetchLeadLookupOptions(currentToken, 'channel').catch(() => ({ options: [] as CrmLeadLookupOption[] })),
      ]);
      setClients(clientOut.clients ?? []);
      setStaffOptions(staffOut.staff ?? []);
      const sources = sourceOut.options ?? [];
      const channels = channelOut.options ?? [];
      setSourceOptions(sources);
      setChannelOptions(channels);
      setSource((prev) => {
        if (sources.some((opt) => opt.option_key === prev)) return prev;
        const manual = sources.find((opt) => opt.option_key === 'manual');
        return manual?.option_key ?? sources[0]?.option_key ?? 'manual';
      });
      if (presetClientId) {
        setClientId(presetClientId);
      }
      if (isB2bFlow && hasCap(getStoredUser(), 'crm_b2b_projects', 'view')) {
        try {
          const projects = await fetchB2bProjects(currentToken, 'active');
          setB2bProjects(projects);
          if (projects.length === 1) setB2bProjectId(projects[0].id);
        } catch {
          setB2bProjects([]);
        }
      }
    })();
  }, [presetClientId, router, isB2bFlow]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !user || !canCreate) return;
    if (!fullName.trim()) {
      setError('Họ tên là bắt buộc');
      return;
    }
    if (isOperationalFlow && !clientId) {
      setError('Chọn khách hàng agency (client) — bắt buộc với lead CSKH vận hành');
      return;
    }
    if (isB2bFlow && b2bProjects.length > 0 && !b2bProjectId) {
      setError('Chọn dự án PTT — bắt buộc với lead B2B');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const lead = await createLead(access, {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        client_id: clientId || undefined,
        source: source.trim() || 'manual',
        channel: channel.trim() || undefined,
        status,
        owner_id: ownerId ? Number(ownerId) : undefined,
        lead_flow_kind: isOperationalFlow ? 'spa_operational' : isB2bFlow ? 'b2b_prospect' : undefined,
        b2b_project_id: isB2bFlow && b2bProjectId ? b2bProjectId : undefined,
      });
      router.push(`/crm/leads/${lead.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(
          'Không ghi được lead — kiểm tra PTT_LEADS_WRITE_ENABLED=1 trên API (ptt-crm-api).',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Tạo lead thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
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
      breadcrumb={[
        { label: 'CRM', href: listHref },
        { label: 'Leads', href: listHref },
        { label: pageTitle },
      ]}
    >
      <DetailPageLayout
        title={pageTitle}
        backHref={listHref}
        backLabel="← Danh sách"
      >
        {!canCreate ? (
          <p className="error">Không có quyền tạo lead (crm_leads · edit).</p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: '0.85rem' }}>
            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>Họ tên *</span>
              <input
                className="kpi-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>SĐT</span>
                <input
                  className="kpi-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                />
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Email</span>
                <input
                  className="kpi-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: '0.35rem' }}>
              <span>{isOperationalFlow ? 'Khách hàng agency *' : 'Khách hàng agency (tuỳ chọn)'}</span>
              <select
                className="kpi-select"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required={isOperationalFlow}
              >
                <option value="">{isB2bFlow ? '— Không gắn client (B2B) —' : '— Chọn client —'}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.code} · {client.name}
                  </option>
                ))}
              </select>
            </label>

            {isB2bFlow && b2bProjects.length > 0 ? (
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Dự án PTT *</span>
                <select
                  className="kpi-select"
                  value={b2bProjectId}
                  onChange={(e) => setB2bProjectId(e.target.value)}
                  required
                >
                  <option value="">— Chọn dự án —</option>
                  {b2bProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Nguồn</span>
                <select
                  className="kpi-select"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  {sourceOptions.length === 0 ? (
                    <option value="manual">manual</option>
                  ) : (
                    sourceOptions.map((opt) => (
                      <option key={opt.id} value={opt.option_key}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Kênh</span>
                <select
                  className="kpi-select"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  <option value="">— Chọn kênh —</option>
                  {channelOptions.map((opt) => (
                    <option key={opt.id} value={opt.option_key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Trạng thái</span>
                <select
                  className="kpi-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: '0.35rem' }}>
                <span>Owner</span>
                <select
                  className="kpi-select"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="">— Chưa gán —</option>
                  {staffOptions.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error ? <p className="error">{error}</p> : null}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn" disabled={saving || !token}>
                {saving ? 'Đang tạo…' : 'Tạo lead'}
              </button>
              <Link href={listHref} className="btn btn-secondary">
                Hủy
              </Link>
            </div>
          </form>
        )}
      </DetailPageLayout>
    </StaffPageShell>
  );
}
