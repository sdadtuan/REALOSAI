'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreativeHistoryList } from '@/components/CreativeHistoryList';
import { CreativeInbox } from '@/components/CreativeInbox';
import { PageToolbar, SegmentedControl } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import {
  approveCreative,
  fetchCreativeHistory,
  fetchPendingCreatives,
  rejectCreative,
  type CreativeRow,
} from '@/lib/api';

type Tab = 'pending' | 'history';

function CreativesPageContent() {
  const searchParams = useSearchParams();
  const focusCreativeId = searchParams.get('focus') ?? searchParams.get('id');
  const [tab, setTab] = useState<Tab>('pending');
  const [pendingRows, setPendingRows] = useState<CreativeRow[]>([]);
  const [historyRows, setHistoryRows] = useState<CreativeRow[]>([]);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  return (
    <PortalPageShell
      breadcrumb={[
        { label: 'Client Portal', href: '/dashboard' },
        { label: 'Creative inbox' },
      ]}
    >
      {({ token, user }) => (
        <CreativesContent
          token={token}
          canApprove={user.role === 'approver'}
          focusCreativeId={focusCreativeId}
          tab={tab}
          setTab={setTab}
          pendingRows={pendingRows}
          setPendingRows={setPendingRows}
          historyRows={historyRows}
          setHistoryRows={setHistoryRows}
          historyCount={historyCount}
          setHistoryCount={setHistoryCount}
          loading={loading}
          setLoading={setLoading}
          error={error}
          setError={setError}
        />
      )}
    </PortalPageShell>
  );
}

export default function CreativesPage() {
  return (
    <Suspense
      fallback={
        <main className="portal-page portal-page--wide">
          <p className="muted">Đang tải…</p>
        </main>
      }
    >
      <CreativesPageContent />
    </Suspense>
  );
}

function CreativesContent(props: {
  token: string;
  canApprove: boolean;
  focusCreativeId: string | null;
  tab: Tab;
  setTab: (tab: Tab) => void;
  pendingRows: CreativeRow[];
  setPendingRows: (rows: CreativeRow[]) => void;
  historyRows: CreativeRow[];
  setHistoryRows: (rows: CreativeRow[]) => void;
  historyCount: number | null;
  setHistoryCount: (count: number | null) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
}) {
  const {
    token,
    canApprove,
    focusCreativeId,
    tab,
    setTab,
    pendingRows,
    setPendingRows,
    historyRows,
    setHistoryRows,
    historyCount,
    setHistoryCount,
    loading,
    setLoading,
    error,
    setError,
  } = props;

  useEffect(() => {
    let cancelled = false;
    void fetchCreativeHistory(token, 30)
      .then((data) => {
        if (!cancelled) setHistoryCount(data.rows.length);
      })
      .catch(() => {
        if (!cancelled) setHistoryCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, setHistoryCount]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (tab === 'pending') {
          const data = await fetchPendingCreatives(token);
          if (!cancelled) setPendingRows(data.rows);
        } else {
          const data = await fetchCreativeHistory(token, 30);
          if (!cancelled) {
            setHistoryRows(data.rows);
            setHistoryCount(data.rows.length);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Không tải được danh sách creative');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, tab, setPendingRows, setHistoryRows, setHistoryCount, setLoading, setError]);

  const pendingCount = pendingRows.length;

  return (
    <div className="page-card">
      <PageToolbar
        title="Creative inbox"
        subtitle="Duyệt hoặc từ chối creative từ AM — đồng bộ Launch QA"
      />

      <div className="portal-kpi-strip">
        <div className="portal-kpi-tile">
          <strong>{pendingCount}</strong>
          <span>Chờ duyệt</span>
        </div>
        <div className="portal-kpi-tile">
          <strong>{historyCount ?? '—'}</strong>
          <span>Lịch sử 30 ngày</span>
        </div>
      </div>

      <SegmentedControl
        label="Tab"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'pending', label: 'Chờ duyệt', badge: pendingCount },
          { id: 'history', label: 'Lịch sử 30 ngày' },
        ]}
      />

      {!canApprove && tab === 'pending' ? (
        <p className="portal-callout portal-callout--warn">
          Tài khoản viewer — chỉ xem danh sách; cần role approver để duyệt/từ chối.
        </p>
      ) : null}

      {canApprove && tab === 'pending' && pendingCount > 0 ? (
        <p className="portal-callout muted">
          Mobile: vuốt trái để duyệt nhanh, vuốt phải để từ chối.
        </p>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : tab === 'pending' ? (
        <CreativeInbox
          rows={pendingRows}
          canApprove={canApprove}
          focusCreativeId={focusCreativeId}
          onApprove={async (id) => {
            await approveCreative(token, id);
            const data = await fetchPendingCreatives(token);
            setPendingRows(data.rows);
          }}
          onReject={async (id, note) => {
            await rejectCreative(token, id, note);
            const data = await fetchPendingCreatives(token);
            setPendingRows(data.rows);
          }}
        />
      ) : (
        <CreativeHistoryList rows={historyRows} />
      )}
    </div>
  );
}
