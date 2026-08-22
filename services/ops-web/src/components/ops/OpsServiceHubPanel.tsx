'use client';

import { useCallback, useEffect, useState } from 'react';
import { OpsAlertsPanel } from '@/components/ops/OpsAlertsPanel';
import { OpsEngineGrid } from '@/components/ops/OpsEngineGrid';
import { OpsHubHeader } from '@/components/ops/OpsHubHeader';
import { OpsKpiPanel } from '@/components/ops/OpsKpiPanel';
import { OpsWeeklyPanel } from '@/components/ops/OpsWeeklyPanel';
import { fetchOpsHub, parseOpsHubError, type OpsHubPayload } from '@/lib/ops-dv-api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';

type Props = {
  token: string;
  lifecycleId: number;
  user: StoredStaffUser | null;
};

export function OpsServiceHubPanel({ token, lifecycleId, user }: Props) {
  const [hub, setHub] = useState<OpsHubPayload | null>(null);
  const [error, setError] = useState('');
  const canEdit = Boolean(user && hasCap(user, 'crm_board', 'edit'));

  const reload = useCallback(async () => {
    const data = await fetchOpsHub(token, lifecycleId);
    setHub(data);
  }, [token, lifecycleId]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    setHub(null);
    void fetchOpsHub(token, lifecycleId)
      .then((data) => {
        if (!cancelled) setHub(data);
      })
      .catch((err) => {
        if (!cancelled) setError(parseOpsHubError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [token, lifecycleId]);

  if (error) return <p className="error">{error}</p>;
  if (!hub) return <p className="muted">Đang tải Ops Hub…</p>;

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <OpsHubHeader lifecycle={hub.lifecycle} dv={hub.dv} />
      <OpsWeeklyPanel
        token={token}
        lifecycleId={lifecycleId}
        weekly={hub.weekly}
        spawnEnabled={hub.flags.weekly_spawn_enabled}
        canEdit={canEdit}
        onRefresh={reload}
      />
      <OpsKpiPanel
        token={token}
        lifecycleId={lifecycleId}
        kpi={hub.kpi}
        canEdit={canEdit}
        onRefresh={reload}
      />
      <OpsAlertsPanel
        token={token}
        lifecycleId={lifecycleId}
        alerts={hub.alerts}
        canEdit={canEdit}
        onRefresh={reload}
      />
      <section>
        <h4 style={{ margin: '0 0 0.5rem' }}>Execution engines</h4>
        <OpsEngineGrid engines={hub.engines} />
      </section>
      {hub.dv.readiness === 'gap' ? (
        <p className="muted">Dịch vụ này chưa có engine tự động — dùng SOP và checklist thủ công.</p>
      ) : null}
      {!hub.flags.pilot_dv ? (
        <p className="muted">DV ngoài pilot P0 — một số link có thể ở trạng thái partial.</p>
      ) : null}
    </div>
  );
}
