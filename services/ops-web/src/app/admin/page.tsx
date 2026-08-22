'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHubSearch } from '@/components/admin/AdminHubSearch';
import { StaffPageShell } from '@/components/layout';
import {
  buildAdminHubWorkspaces,
  buildAdminNavGroups,
  canViewAdminSection,
} from '@/lib/admin/admin-nav';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

const WORKSPACE_ICONS: Record<string, string> = {
  org: '👥',
  rbac: '🔐',
  data: '📋',
  ai: '🤖',
  compliance: '🛡',
  policy: '🧠',
  integrations: '🔌',
};

export default function AdminControlPlaneHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [error, setError] = useState('');

  const ensureAuth = useCallback(async (): Promise<StoredStaffUser | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      if (!canViewAdminSection(me)) {
        setError('Không có quyền truy cập Quản trị hệ thống');
        return null;
      }
      setUser(me);
      updateStoredUser(me);
      return me;
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
      if (!canViewAdminSection(me)) {
        setError('Không có quyền truy cập Quản trị hệ thống');
        return null;
      }
      setUser(me);
      updateStoredUser(me);
      return me;
    }
  }, [router]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const workspaces = buildAdminHubWorkspaces(user);
  const groups = buildAdminNavGroups(user);

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[{ label: 'Quản trị hệ thống' }]}
      width="wide"
    >
      <div className="admin-cp-hub">
        <div className="admin-cp-hub__hero">
          <div>
            <p className="admin-cp-hub__eyebrow">Control Plane</p>
            <h1 className="admin-cp-hub__title">Quản trị hệ thống</h1>
            <p className="admin-cp-hub__lead">
              Identity, RBAC, schema CRM và AI governance — một workspace tập trung, tách khỏi vận
              hành hàng ngày.
            </p>
            <AdminHubSearch user={user} />
          </div>
          <div className="admin-cp-hub__meta">
            <span className="admin-cp-hub__pill">Onboard ≤15 phút</span>
            <span className="admin-cp-hub__pill">Fail-closed RBAC</span>
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}

        {!error && workspaces.length === 0 && user ? (
          <p className="muted">Chưa có workspace admin khả dụng với quyền hiện tại.</p>
        ) : null}

        <div className="admin-cp-workspace-grid">
          {workspaces.map((ws) => (
            <Link key={ws.id} href={ws.href} className="admin-cp-workspace-card">
              <span className="admin-cp-workspace-card__icon" aria-hidden>
                {WORKSPACE_ICONS[ws.id] ?? '•'}
              </span>
              <div className="admin-cp-workspace-card__body">
                <strong>{ws.title}</strong>
                <span className="muted">{ws.description}</span>
                <span className="admin-cp-workspace-card__stat">{ws.stat}</span>
              </div>
            </Link>
          ))}
        </div>

        {groups.map((group) => (
          <section key={group.id} className="admin-cp-hub__section">
            <h2 className="section-title">{group.label}</h2>
            <div className="hub-module-grid">
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} className="summary-card hub-module-card">
                  <span className="muted">{group.description}</span>
                  <strong>{link.label}</strong>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <p className="muted admin-cp-hub__footnote">
          Hồ sơ roster vận hành: <Link href="/crm/staff">Nhân sự → Nhân viên</Link>. Tài khoản login
          và phân quyền chỉ cấu hình tại đây.
        </p>
      </div>
    </StaffPageShell>
  );
}
