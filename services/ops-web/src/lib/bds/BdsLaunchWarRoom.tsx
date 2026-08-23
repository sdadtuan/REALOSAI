'use client';

import type { LaunchRow } from './api';
import type { LaunchWarRoomData } from './use-launch-war-room';
import {
  formatLaunchTtlSec,
  launchStatusBadge,
  launchTtlBarPercent,
  launchTtlUrgency,
  ttlRemainingFromExpires,
  unitLabel,
} from './launch-copy';

type Props = {
  launch: LaunchRow;
  warRoom: LaunchWarRoomData;
  unitCodes: Record<number, string>;
  tick: Date;
};

function TtlBar({
  remainingSec,
  totalSec,
}: {
  remainingSec: number | null;
  totalSec: number;
}) {
  const urgency = launchTtlUrgency(remainingSec, totalSec);
  const pct = launchTtlBarPercent(remainingSec, totalSec);
  return (
    <div className="bds-war-room-ttl">
      <div className="bds-war-room-ttl__head">
        <span className={`bds-war-room-ttl__value bds-war-room-ttl__value--${urgency}`}>
          {formatLaunchTtlSec(remainingSec)}
        </span>
      </div>
      <div className="bds-war-room-ttl__track" aria-hidden="true">
        <div
          className={`bds-war-room-ttl__fill bds-war-room-ttl__fill--${urgency}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function BdsLaunchWarRoom({ launch, warRoom, unitCodes, tick }: Props) {
  const totalTtl = launch.hold_ttl_seconds;
  const holds = warRoom.holds ?? [];
  const queues = (warRoom.queues ?? []).filter((q) => q.status === 'waiting');
  const conflicts = warRoom.conflicts ?? [];

  const queueByProduct = new Map<number, number>();
  queues.forEach((q, idx) => {
    if (!queueByProduct.has(q.product_id)) queueByProduct.set(q.product_id, idx + 1);
  });

  return (
    <div className="bds-war-room">
      <div className="bds-war-room__meta">
        <span className="bds-war-room__badge bds-war-room__badge--open">
          {launchStatusBadge(launch.status)}
        </span>
        <span className="bds-war-room__chip">TTL giữ {totalTtl}s</span>
        <span className="bds-war-room__poll muted">Cập nhật 3s</span>
      </div>

      <div className="bds-war-room__grid">
        <section className="bds-war-room__col" aria-label="Giữ chỗ">
          <h4 className="bds-war-room__col-title">Giữ chỗ</h4>
          {holds.length === 0 ? (
            <p className="muted bds-war-room__empty">Chưa có hold active.</p>
          ) : (
            <ul className="bds-war-room__list">
              {holds.map((h) => {
                const remaining =
                  ttlRemainingFromExpires(h.expires_at, tick) ??
                  h.ttl_remaining_sec;
                return (
                  <li key={h.hold_id} className="bds-war-room__row">
                    <div className="bds-war-room__row-main">
                      <strong>{unitLabel(h.product_id, unitCodes)}</strong>
                      <span className="muted">Lead #{h.lead_id}</span>
                      <span className="badge">{h.status}</span>
                    </div>
                    <TtlBar remainingSec={remaining} totalSec={totalTtl} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bds-war-room__col" aria-label="Hàng đợi">
          <h4 className="bds-war-room__col-title">Hàng đợi FIFO</h4>
          {queues.length === 0 ? (
            <p className="muted bds-war-room__empty">Trống — 409 căn bận sẽ vào đây.</p>
          ) : (
            <ul className="bds-war-room__list">
              {queues.map((q, idx) => (
                <li key={q.id} className="bds-war-room__row bds-war-room__row--queue">
                  <span className="bds-war-room__queue-no">#{idx + 1}</span>
                  <div className="bds-war-room__row-main">
                    <strong>{unitLabel(q.product_id, unitCodes)}</strong>
                    <span className="muted">Lead #{q.lead_id}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bds-war-room__col" aria-label="Xung đột">
          <h4 className="bds-war-room__col-title">Xung đột 409</h4>
          {conflicts.length === 0 ? (
            <p className="muted bds-war-room__empty">Không có căn chờ promote.</p>
          ) : (
            <ul className="bds-war-room__list">
              {conflicts.map((c) => (
                <li key={c.product_id} className="bds-war-room__row bds-war-room__row--conflict">
                  <div className="bds-war-room__row-main">
                    <strong>{unitLabel(c.product_id, unitCodes)}</strong>
                    <span className="bds-war-room__waiting">{c.waiting} đang chờ</span>
                  </div>
                  {queueByProduct.has(c.product_id) ? (
                    <span className="muted bds-war-room__hint">
                      Hàng đợi #{queueByProduct.get(c.product_id)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
