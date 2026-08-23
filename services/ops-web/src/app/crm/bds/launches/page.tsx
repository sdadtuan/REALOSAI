'use client';

import { useEffect, useMemo, useState } from 'react';
import { StaffPageShell, HubPageLayout } from '@/components/layout';
import { hasCap } from '@/lib/auth';
import {
  fetchBdsLaunches,
  fetchPriceLists,
  fetchProjectUnits,
  postCloseLaunch,
  postOpenLaunch,
  type LaunchRow,
} from '@/lib/bds/api';
import { BdsG0Banner } from '@/lib/bds/BdsG0Banner';
import { BdsLaunchChecklist } from '@/lib/bds/BdsLaunchChecklist';
import { BdsLaunchWarRoom } from '@/lib/bds/BdsLaunchWarRoom';
import { launchOpenBlockedTooltip } from '@/lib/bds/g0-copy';
import {
  buildLaunchOpenChecklist,
  canOpenFromChecklist,
  launchStatusBadge,
  priceLockBannerLabel,
} from '@/lib/bds/launch-copy';
import { useBdsG0 } from '@/lib/bds/use-bds-g0';
import { useLaunchWarRoom } from '@/lib/bds/use-launch-war-room';
import { useBdsPageAuth } from '@/lib/bds/use-bds-page-auth';

export default function BdsLaunchesPage() {
  const { user, token, error, loading, notFound, logout } = useBdsPageAuth([
    { section: 'bds_launches', action: 'view' },
  ]);
  const [rows, setRows] = useState<LaunchRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [priceLists, setPriceLists] = useState<Awaited<ReturnType<typeof fetchPriceLists>>>([]);
  const [unitCodes, setUnitCodes] = useState<Record<number, string>>({});

  const canOpen = hasCap(user, 'bds_launches', 'open');
  const g0 = useBdsG0(token, true);
  const g0Blocked = Boolean(g0.status && !g0.status.ready);
  const openTooltip = g0Blocked
    ? launchOpenBlockedTooltip(g0.status?.missing_position_codes ?? [])
    : '';

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const warRoomEnabled = Boolean(token && selected?.status === 'open');
  const { data: warRoom, error: warRoomError, tick } = useLaunchWarRoom(
    token,
    selected?.id ?? null,
    warRoomEnabled,
  );

  const checklist = useMemo(() => {
    if (!selected) return [];
    return buildLaunchOpenChecklist({
      g0Ready: !g0Blocked,
      missingG0: g0.status?.missing_position_codes ?? [],
      priceListId: selected.price_list_id,
      phaseId: selected.phase_id,
      holdTtlSeconds: selected.hold_ttl_seconds,
    });
  }, [selected, g0Blocked, g0.status?.missing_position_codes]);

  const checklistOk = canOpenFromChecklist(checklist);
  const openDisabled = g0Blocked || !checklistOk;

  const reload = async (accessToken: string) => {
    setRows(await fetchBdsLaunches(accessToken));
  };

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        await reload(token);
      } catch (err) {
        setLoadError(
          err instanceof Error && err.message.includes('404')
            ? 'Ra quân chưa bật'
            : err instanceof Error
              ? err.message
              : 'Tải ra quân thất bại',
        );
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token || !selected) {
      setPriceLists([]);
      setUnitCodes({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [lists, units] = await Promise.all([
          fetchPriceLists(token, selected.project_id),
          selected.status === 'open'
            ? fetchProjectUnits(token, selected.project_id)
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setPriceLists(lists);
        const map: Record<number, string> = {};
        for (const u of units) map[u.id] = u.unit_code;
        setUnitCodes(map);
      } catch {
        if (!cancelled) {
          setPriceLists([]);
          setUnitCodes({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selected]);

  const runAction = async (fn: () => Promise<unknown>) => {
    if (!token) return;
    setActionError('');
    try {
      await fn();
      await reload(token);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Thao tác thất bại');
    }
  };

  if (notFound) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không tìm thấy</p>
      </main>
    );
  }

  return (
    <StaffPageShell user={user} onLogout={logout} loading={!user && loading}>
      <HubPageLayout
        title="Ra quân"
        subtitle="Khóa giá · TTL ngắn · hàng đợi FIFO (SCR-BDS-070)"
      >
        <BdsG0Banner status={g0.status} loading={g0.loading} />
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {loadError ? <p className="muted">{loadError}</p> : null}
        {actionError ? <p className="error">{actionError}</p> : null}
        {!loading && !error && !loadError && rows.length === 0 ? (
          <p className="muted">Chưa có sự kiện ra quân.</p>
        ) : null}

        {rows.length > 0 ? (
          <div className="page-card bds-launch-table-wrap">
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Dự án</th>
                  <th>TTL giữ</th>
                  <th>Bảng giá</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={selectedId === row.id ? 'bds-launch-table__row--selected' : undefined}
                  >
                    <td>{row.project_id}</td>
                    <td>
                      <span className="bds-launch-ttl-pill">{row.hold_ttl_seconds}s</span>
                    </td>
                    <td>{row.price_list_id ?? '—'}</td>
                    <td>
                      <span
                        className={`bds-launch-status bds-launch-status--${row.status}`}
                      >
                        {launchStatusBadge(row.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {selected && token ? (
          <section className="bds-launch-detail">
            <header className="bds-launch-detail__head">
              <div>
                <h3>Ra quân · dự án {selected.project_id}</h3>
                <p className="muted bds-launch-detail__id">{selected.id}</p>
              </div>
              <div className="bds-launch-detail__actions">
                {selected.status === 'draft' && canOpen ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={openDisabled}
                    title={
                      openTooltip ||
                      (!checklistOk ? 'Hoàn thành checklist trước khi mở' : undefined)
                    }
                    onClick={() => void runAction(() => postOpenLaunch(token, selected.id))}
                  >
                    Mở ra quân
                  </button>
                ) : null}
                {selected.status === 'open' && canOpen ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void runAction(() => postCloseLaunch(token, selected.id))}
                  >
                    Đóng
                  </button>
                ) : null}
              </div>
            </header>

            <div
              className={`bds-launch-price-lock${
                selected.status === 'open' ? ' bds-launch-price-lock--locked' : ''
              }`}
            >
              {priceLockBannerLabel(
                selected.price_list_id,
                priceLists,
                selected.status === 'open',
              )}
            </div>

            {selected.status === 'draft' ? (
              <div className="page-card bds-launch-checklist-wrap">
                <h4>Checklist trước mở</h4>
                <BdsLaunchChecklist items={checklist} />
              </div>
            ) : null}

            {selected.status === 'open' && warRoom ? (
              <BdsLaunchWarRoom
                launch={selected}
                warRoom={warRoom}
                unitCodes={unitCodes}
                tick={tick}
              />
            ) : null}

            {selected.status === 'open' && warRoomError ? (
              <p className="error">{warRoomError}</p>
            ) : null}

            {selected.status === 'closed' ? (
              <p className="muted">Sự kiện đã đóng — TTL hold về CSBH thường.</p>
            ) : null}
          </section>
        ) : null}
      </HubPageLayout>
    </StaffPageShell>
  );
}
