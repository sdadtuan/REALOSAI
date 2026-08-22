'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HubPageLayout, StaffPageShell } from '@/components/layout';
import { ArticlesTab } from '@/components/gtm-cms/ArticlesTab';
import { EventsTab } from '@/components/gtm-cms/EventsTab';
import { MediaTab } from '@/components/gtm-cms/MediaTab';
import { SlotsTab } from '@/components/gtm-cms/SlotsTab';
import { canViewGtmCms } from '@/lib/gtm/caps';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { staffMe, staffRefresh } from '@/lib/api';

const TABS = ['media', 'articles', 'events', 'slots'] as const;
type CmsTab = (typeof TABS)[number];

function parseTab(raw: string | null): CmsTab {
  if (raw && TABS.includes(raw as CmsTab)) return raw as CmsTab;
  return 'media';
}

export default function GtmCmsPage() {
  return (
    <Suspense
      fallback={
        <StaffPageShell user={null} onLogout={() => {}} loading>
          <span />
        </StaffPageShell>
      }
    >
      <GtmCmsContent />
    </Suspense>
  );
}

function GtmCmsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const tab = useMemo(() => parseTab(searchParams.get('tab')), [searchParams]);

  const ensureAuth = useCallback(async (): Promise<boolean> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return false;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canViewGtmCms(me)) {
        setError('Không có quyền CMS marketing');
        return false;
      }
      return true;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return false;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!canViewGtmCms(me)) {
        setError('Không có quyền CMS marketing');
        return false;
      }
      return true;
    }
  }, [router]);

  useEffect(() => {
    void (async () => {
      await ensureAuth();
      setLoading(false);
    })();
  }, [ensureAuth]);

  function setTab(next: CmsTab) {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set('tab', next);
    router.replace(`/crm/gtm/cms?${qs.toString()}`);
  }

  function onToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(''), 4000);
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user && loading) {
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
      breadcrumb={[{ label: 'GTM', href: '/crm/gtm/demos' }, { label: 'CMS marketing' }]}
    >
      <HubPageLayout
        title="CMS marketing site"
        subtitle="Media, tin tức, sự kiện và slot ảnh cho pttcrm.com"
        tabs={[
          { id: 'media' as const, label: 'Media' },
          { id: 'articles' as const, label: 'Articles' },
          { id: 'events' as const, label: 'Events' },
          { id: 'slots' as const, label: 'Slots' },
        ]}
        tab={tab}
        onTabChange={setTab}
      >
        {error ? <p className="error">{error}</p> : null}
        {toast ? <p className="badge">{toast}</p> : null}

        {user && !error ? (
          <>
            {tab === 'media' ? <MediaTab user={user} onToast={onToast} /> : null}
            {tab === 'articles' ? <ArticlesTab user={user} onToast={onToast} /> : null}
            {tab === 'events' ? <EventsTab user={user} onToast={onToast} /> : null}
            {tab === 'slots' ? <SlotsTab user={user} onToast={onToast} /> : null}
          </>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
