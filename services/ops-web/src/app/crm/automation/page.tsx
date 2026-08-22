'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AutomationWorkflowsPanel } from '@/components/automation/AutomationWorkflowsPanel';
import { fetchAutomationWorkflows } from '@/lib/automation-api';
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

export default function CrmAutomationPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchAutomationWorkflows>>['data']['rows']>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

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
      if (!hasCap(me, 'automation_workflows', 'view')) {
        setError('Không có quyền automation_workflows.view');
        return null;
      }
      setToken(access);
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      try {
        const refreshed = await staffRefresh(refresh);
        updateAccessToken(refreshed.access_token);
        const me = await staffMe(refreshed.access_token);
        setUser(me);
        updateStoredUser(me);
        if (!hasCap(me, 'automation_workflows', 'view')) {
          setError('Không có quyền automation_workflows.view');
          return null;
        }
        setToken(refreshed.access_token);
        return refreshed.access_token;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    }
  }, [router]);

  const reload = useCallback(async () => {
    const access = token ?? (await ensureAuth());
    if (!access) return;
    try {
      const list = await fetchAutomationWorkflows(access, { limit: 50, offset: 0 });
      setRows(list.data.rows);
      setTotal(list.data.total);
      setError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tải workflows';
      setError(msg);
      setRows([]);
      setTotal(0);
    }
  }, [ensureAuth, token]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const access = await ensureAuth();
      if (!access) {
        setLoading(false);
        return;
      }
      try {
        const list = await fetchAutomationWorkflows(access, { limit: 50, offset: 0 });
        setRows(list.data.rows);
        setTotal(list.data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải workflows');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  if (!user) {
    return (
      <AdminPageShell
        user={null}
        onLogout={logout}
        section="ai-automation"
        title="Workflow automation"
        subtitle="UI-R2-04 · AI nodes + simulate"
        loading
      >
        <span />
      </AdminPageShell>
    );
  }

  const canConfigure = hasCap(user, 'automation_workflows', 'configure');
  const canSimulate = hasCap(user, 'automation_workflows', 'simulate');

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="ai-automation"
      title="Workflow automation"
      subtitle="UI-R2-04 · AI nodes + simulate"
    >
      <div className="page-card stack-gap">
        {loading ? <p>Đang tải…</p> : null}
        {error ? <p className="automation-workflows-error">{error}</p> : null}
        {token ? (
          <AutomationWorkflowsPanel
            token={token}
            canConfigure={canConfigure}
            canSimulate={canSimulate}
            initialRows={rows}
            initialTotal={total}
            onReload={reload}
          />
        ) : null}
      </div>
    </AdminPageShell>
  );
}
