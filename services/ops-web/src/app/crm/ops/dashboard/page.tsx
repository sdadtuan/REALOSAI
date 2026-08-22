'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import {
  OpsAmDashboardPanel,
  OpsExecutiveDashboardPanel,
  OpsSpecialistDashboardPanel,
  OpsTeamLeadDashboardPanel,
} from '@/components/ops/OpsDashboardPanels';
import {
  fetchOpsDashboardAm,
  fetchOpsDashboardExecutive,
  fetchOpsDashboardSpecialist,
  fetchOpsDashboardTeamLead,
  type OpsDashboardAmPayload,
  type OpsDashboardExecutivePayload,
  type OpsDashboardSpecialistPayload,
  type OpsDashboardTeamLeadPayload,
} from '@/lib/ops-dv-api';
import { isOpsDvFeEnabled } from '@/lib/ops-dv-flags';
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
import { staffMe, staffRefresh } from '@/lib/api';

type DashTab = 'am' | 'team_lead' | 'specialist' | 'executive';

export default function CrmOpsDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [tab, setTab] = useState<DashTab>('am');
  const [am, setAm] = useState<OpsDashboardAmPayload | null>(null);
  const [teamLead, setTeamLead] = useState<OpsDashboardTeamLeadPayload | null>(null);
  const [specialist, setSpecialist] = useState<OpsDashboardSpecialistPayload | null>(null);
  const [executive, setExecutive] = useState<OpsDashboardExecutivePayload | null>(null);
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
      if (!hasCap(me, 'crm_board', 'view')) {
        setError('Không có quyền xem dashboard vận hành DV');
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

  const load = useCallback(
    async (access: string, nextTab: DashTab) => {
      setLoading(true);
      setError('');
      try {
        if (nextTab === 'am') setAm(await fetchOpsDashboardAm(access, user?.id));
        if (nextTab === 'team_lead') setTeamLead(await fetchOpsDashboardTeamLead(access));
        if (nextTab === 'specialist') setSpecialist(await fetchOpsDashboardSpecialist(access));
        if (nextTab === 'executive') setExecutive(await fetchOpsDashboardExecutive(access));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dashboard thất bại');
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    if (!isOpsDvFeEnabled()) {
      setError('Ops DV chưa bật (NEXT_PUBLIC_OPS_DV).');
      return;
    }
    void ensureAuth().then((access) => {
      if (access) void load(access, tab);
    });
  }, [ensureAuth, load, tab]);

  function switchTab(next: DashTab) {
    setTab(next);
    void ensureAuth().then((access) => {
      if (access) void load(access, next);
    });
  }

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      title="Dashboard vận hành DV"
      subtitle="AM · Team Lead · Specialist · Executive"
      loading={loading}
    >
      {error ? <p className="error">{error}</p> : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {(['am', 'team_lead', 'specialist', 'executive'] as DashTab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
            onClick={() => switchTab(key)}
          >
            {key === 'am'
              ? 'AM'
              : key === 'team_lead'
                ? 'Team Lead'
                : key === 'specialist'
                  ? 'Specialist'
                  : 'Executive'}
          </button>
        ))}
      </div>
      {tab === 'am' && am ? <OpsAmDashboardPanel data={am} /> : null}
      {tab === 'team_lead' && teamLead ? <OpsTeamLeadDashboardPanel data={teamLead} /> : null}
      {tab === 'specialist' && specialist ? <OpsSpecialistDashboardPanel data={specialist} /> : null}
      {tab === 'executive' && executive ? <OpsExecutiveDashboardPanel data={executive} /> : null}
    </CrmDeliveryPageShell>
  );
}
