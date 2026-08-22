'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AgencyReadOnlyBadge, canAgencyWrite } from '@/components/AgencyReadOnlyBadge';
import { HubCampaignMapsPanel } from '@/components/HubCampaignMapsPanel';
import { ContractApprovalsPanel } from '@/components/ContractApprovalsPanel';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
import { winCplDigestEnabled } from '@/lib/win/flags';
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

type HubTab = 'campaigns' | 'contracts';

export function CrmHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientFilter = searchParams.get('client_id') ?? '';
  const campaignFilter = searchParams.get('campaign_id') ?? '';
  const tabParam = searchParams.get('hub_tab');
  const [hubTab, setHubTab] = useState<HubTab>(tabParam === 'contracts' ? 'contracts' : 'campaigns');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [accessToken, setAccessToken] = useState('');

  const canWrite = canAgencyWrite(user);

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
      if (!hasCap(me, 'crm_agency', 'view') && !hasCap(me, 'crm_leads', 'assign')) {
        setError('Không có quyền Hub');
        return null;
      }
      setAccessToken(access);
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
      setAccessToken(out.access_token);
      return out.access_token;
    }
  }, [router]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

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
        { label: 'CRM', href: '/crm' },
        { label: 'Hub', href: '/crm/hub' },
        { label: 'Agency map' },
      ]}
    >
      <HubPageLayout
        title="Hub · Agency"
        subtitle="Campaign map và hợp đồng chờ duyệt"
        headerExtra={<AgencyReadOnlyBadge user={user} />}
        tabs={[
          { id: 'campaigns' as HubTab, label: 'Campaign map' },
          { id: 'contracts' as HubTab, label: 'HĐ chờ duyệt' },
        ]}
        tab={hubTab}
        onTabChange={setHubTab}
      >
        {clientFilter ? (
          <p className="muted" style={{ marginTop: 0 }}>
            Lọc client:{' '}
            <Link href={`/agency/clients/${clientFilter}?tab=campaigns`} className="nav-link">
              {clientFilter.slice(0, 8)}…
            </Link>{' '}
            ·{' '}
            <Link href="/crm/hub" className="nav-link">
              Bỏ lọc
            </Link>
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}

        {winCplDigestEnabled() &&
        user &&
        (hasCap(user, 'crm_ai_insights', 'view') || hasCap(user, 'crm_business_dashboard', 'view')) ? (
          <p style={{ margin: '0 0 1rem' }}>
            <Link href="/crm/ai/cpl-digest" className="nav-link">
              CPL anomaly digest (WIN-4-C) →
            </Link>
          </p>
        ) : null}

        {hubTab === 'campaigns' && accessToken ? (
          <>
            {campaignFilter ? <p className="muted">Lọc hub_campaign_id={campaignFilter}</p> : null}
            <HubCampaignMapsPanel
              token={accessToken}
              canWrite={canWrite}
              showClientColumn
              filterClientId={clientFilter || undefined}
              filterCampaignId={campaignFilter || undefined}
              onFeedback={setMsg}
              onError={setError}
            />
          </>
        ) : null}

        {hubTab === 'contracts' && accessToken ? (
          <ContractApprovalsPanel
            token={accessToken}
            user={user}
            onMessage={setMsg}
            onError={setError}
          />
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
