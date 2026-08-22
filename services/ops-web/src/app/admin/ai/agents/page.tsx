'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import {
  OrchestrationTracePanel,
  type OrchestrationFilters,
} from '@/components/ai/OrchestrationTracePanel';
import {
  fetchOrchestrationById,
  fetchOrchestrations,
  type AiOrchestration,
  type OrchestrationDetail,
} from '@/lib/ai-api';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

const PAGE_SIZE = 50;

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function AdminAiAgentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailRequestRef = useRef(0);
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [filters, setFilters] = useState<OrchestrationFilters>({
    from: isoDateDaysAgo(7),
    to: todayIsoDate(),
    planKey: '',
    status: '',
  });
  const [rows, setRows] = useState<AiOrchestration[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AiOrchestration | null>(null);
  const [detail, setDetail] = useState<OrchestrationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const authorize = useCallback(
    (me: StoredStaffUser): boolean => {
      if (!hasCap(me, 'ai_admin', 'view')) {
        setError('Không có quyền AI admin (ai_admin.view)');
        return false;
      }
      setUser(me);
      updateStoredUser(me);
      return true;
    },
    [],
  );

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    try {
      const me = await staffMe(access);
      return authorize(me) ? access : null;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const refreshed = await staffRefresh(refresh);
      access = refreshed.access_token;
      updateAccessToken(access);
      const me = await staffMe(access);
      return authorize(me) ? access : null;
    }
  }, [authorize, router]);

  const loadOrchestrations = useCallback(
    async (access: string, nextOffset: number, nextFilters = filters) => {
      detailRequestRef.current += 1;
      setDetailLoading(false);
      setLoading(true);
      setError('');
      try {
        const out = await fetchOrchestrations(access, {
          from: nextFilters.from ? `${nextFilters.from}T00:00:00.000Z` : undefined,
          to: nextFilters.to ? `${nextFilters.to}T23:59:59.999Z` : undefined,
          plan_key: nextFilters.planKey.trim() || undefined,
          status: nextFilters.status || undefined,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        setRows(out.data.rows);
        setTotal(out.data.total);
        setOffset(out.data.offset);
        setSelected(null);
        setDetail(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải orchestration thất bại');
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  const loadDetail = useCallback(async (access: string, row: AiOrchestration) => {
    const requestId = ++detailRequestRef.current;
    setSelected(row);
    setDetail(null);
    setDetailLoading(true);
    setError('');
    try {
      const out = await fetchOrchestrationById(access, row.id);
      if (requestId !== detailRequestRef.current) return;
      setDetail(out.data);
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      setError(err instanceof Error ? err.message : 'Tải orchestration trace thất bại');
    } finally {
      if (requestId === detailRequestRef.current) {
        setDetailLoading(false);
      }
    }
  }, []);

  const loadDetailById = useCallback(async (access: string, id: string) => {
    const requestId = ++detailRequestRef.current;
    setDetail(null);
    setDetailLoading(true);
    setError('');
    try {
      const out = await fetchOrchestrationById(access, id);
      if (requestId !== detailRequestRef.current) return;
      setSelected(out.data.orchestration);
      setDetail(out.data);
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      setError(err instanceof Error ? err.message : 'Tải orchestration trace thất bại');
    } finally {
      if (requestId === detailRequestRef.current) {
        setDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadOrchestrations(access, 0);
      const id = searchParams.get('id');
      if (id) {
        await loadDetailById(access, id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial authenticated load only
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <AdminPageShell
        user={null}
        onLogout={logout}
        section="ai-automation"
        title="Multi-agent traces"
        subtitle="UI-R4-03 · parent orchestration → child agent runs"
        loading
      >
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="ai-automation"
      title="Multi-agent traces"
      subtitle="UI-R4-03 · parent orchestration → child agent runs"
    >
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}

        <OrchestrationTracePanel
          rows={rows}
          total={total}
          limit={PAGE_SIZE}
          offset={offset}
          filters={filters}
          loading={loading}
          selected={selected}
          detail={detail}
          detailLoading={detailLoading}
          onFiltersChange={(patch) => setFilters((previous) => ({ ...previous, ...patch }))}
          onApplyFilters={() => {
            const access = getAccessToken();
            if (!access) return;
            void loadOrchestrations(access, 0);
          }}
          onSelectRow={(row) => {
            const access = getAccessToken();
            if (!access) return;
            void loadDetail(access, row);
          }}
          onPrevPage={() => {
            const access = getAccessToken();
            if (!access) return;
            void loadOrchestrations(access, Math.max(0, offset - PAGE_SIZE));
          }}
          onNextPage={() => {
            const access = getAccessToken();
            if (!access) return;
            void loadOrchestrations(access, offset + PAGE_SIZE);
          }}
        />
      </div>
    </AdminPageShell>
  );
}

export default function AdminAiAgentsPage() {
  return (
    <Suspense
      fallback={
        <AdminPageShell
          user={null}
          onLogout={() => {}}
          section="ai-automation"
          title="Multi-agent traces"
          subtitle="UI-R4-03 · parent orchestration → child agent runs"
          loading
        >
          <span />
        </AdminPageShell>
      }
    >
      <AdminAiAgentsContent />
    </Suspense>
  );
}
