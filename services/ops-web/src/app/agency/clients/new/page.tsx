'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgencyHubPageShell } from '@/components/agency/AgencyHubPageShell';
import { AgencyReadOnlyBadge, canAgencyWrite } from '@/components/AgencyReadOnlyBadge';
import { IndustrySelect } from '@/components/agency/IndustrySelect';
import { OwnerAmSelect } from '@/components/agency/OwnerAmSelect';
import { createAgencyClient, staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function NewClientPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [industrySlug, setIndustrySlug] = useState('');
  const [ownerAmId, setOwnerAmId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    setToken(access);
    staffMe(access)
      .then((me) => {
        setUser(me);
        if (!hasCap(me, 'crm_agency', 'view')) {
          router.replace('/agency');
          return;
        }
        if (!canAgencyWrite(me)) {
          setError('Không có quyền tạo client');
        }
      })
      .catch(async () => {
        const refresh = getRefreshToken();
        if (!refresh) {
          router.replace('/login');
          return;
        }
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        setToken(out.access_token);
        const me = await staffMe(out.access_token);
        setUser(me);
        updateStoredUser(me);
      });
  }, [router]);

  useEffect(() => {
    if (user?.email && !ownerAmId) {
      setOwnerAmId(user.email);
    }
  }, [user?.email, ownerAmId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !user || !canAgencyWrite(user)) return;
    setSaving(true);
    setError('');
    try {
      const client = await createAgencyClient(access, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        industry_slug: industrySlug || undefined,
        owner_am_id: ownerAmId.trim() || user.email || undefined,
      });
      router.push(`/agency/clients/${client.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo client thất bại');
    } finally {
      setSaving(false);
    }
  }

  const canWrite = user ? canAgencyWrite(user) : false;

  if (!user) {
    return (
      <AgencyHubPageShell
        user={null}
        onLogout={logout}
        title="Client mới"
        showModuleNav={false}
        width="narrow"
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
      title="Client mới"
      showModuleNav={false}
      width="narrow"
      actions={<AgencyReadOnlyBadge user={user} />}
      breadcrumb={[{ label: 'Agency', href: '/agency' }, { label: 'Client mới' }]}
    >
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'grid', gap: '0.85rem' }}>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="muted">Mã (CODE)</span>
            <input
              className="kpi-input"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="muted">Tên</span>
            <input
              className="kpi-input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="muted">Ngành</span>
            {token ? (
              <IndustrySelect
                token={token}
                value={industrySlug}
                onChange={setIndustrySlug}
                required
                disabled={!canWrite}
              />
            ) : null}
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span className="muted">Owner AM</span>
            {token ? (
              <OwnerAmSelect
                token={token}
                value={ownerAmId}
                onChange={setOwnerAmId}
                disabled={!canWrite}
              />
            ) : null}
          </label>
          <button type="submit" className="btn btn-sm" disabled={saving || !canWrite || !!error || !industrySlug}>
            {saving ? 'Đang tạo…' : 'Tạo client'}
          </button>
        </form>
      </div>
    </AgencyHubPageShell>
  );
}
