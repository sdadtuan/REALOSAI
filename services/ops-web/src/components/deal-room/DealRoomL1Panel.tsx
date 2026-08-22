'use client';

import { useCallback, useEffect, useState } from 'react';
import { PresalesR5PlanForm } from '@/components/PresalesR5PlanForm';
import { PresalesR5PreviewPanel } from '@/components/PresalesR5PreviewPanel';
import {
  patchLeadPresalesMarketingPlan,
  type DealRoomSnapshot,
} from '@/lib/api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { resolvePresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';

interface Props {
  token: string;
  leadId: number;
  user: StoredStaffUser;
  snapshot: DealRoomSnapshot;
  onUpdated: (snapshot: DealRoomSnapshot) => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
}

export function DealRoomL1Panel({
  token,
  leadId,
  user,
  snapshot,
  onUpdated,
  onMessage,
  onError,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [planName, setPlanName] = useState(snapshot.marketing_plan.name);
  const [planNorthStar, setPlanNorthStar] = useState(snapshot.marketing_plan.north_star);
  const [planObjectives, setPlanObjectives] = useState(snapshot.marketing_plan.objectives);
  const [planStrategy, setPlanStrategy] = useState(snapshot.marketing_plan.strategy_framework);
  const [planValidation, setPlanValidation] = useState(snapshot.marketing_plan.validation_messages);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPlanName(snapshot.marketing_plan.name);
    setPlanNorthStar(snapshot.marketing_plan.north_star);
    setPlanObjectives(snapshot.marketing_plan.objectives);
    setPlanStrategy(snapshot.marketing_plan.strategy_framework);
    setPlanValidation(snapshot.marketing_plan.validation_messages);
  }, [snapshot]);

  const solutionCaps = resolvePresalesSolutionCaps(user);
  const stage = snapshot.presales.presales.stage === 'proposal' ? 'proposal' : 'consult';
  const canEdit = Boolean(
    user &&
      hasCap(user, 'crm_leads', 'edit') &&
      solutionCaps.canEditConsult &&
      snapshot.presales.presales.stage !== 'lead',
  );

  const reloadSnapshot = useCallback(async () => {
    const { fetchLeadDealRoom } = await import('@/lib/api');
    const next = await fetchLeadDealRoom(token, leadId);
    onUpdated(next);
  }, [leadId, onUpdated, token]);

  async function onSavePlan() {
    if (!canEdit) return;
    setBusy(true);
    onError?.('');
    try {
      const out = await patchLeadPresalesMarketingPlan(token, leadId, {
        name: planName,
        north_star: planNorthStar,
        objectives: planObjectives,
        strategy_framework: planStrategy,
      });
      setPlanValidation(out.validation?.messages ?? []);
      onMessage?.('Đã lưu KH MKT sơ bộ (R5)');
      setEditMode(false);
      await reloadSnapshot();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Lưu R5 thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="deal-room-panel deal-room-panel--l1" aria-label="L1 marketing plan">
      <div className="deal-room-panel__head">
        <h3 className="deal-room-panel__title">KH Marketing sơ bộ (L1 / R5)</h3>
        {canEdit && !editMode ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditMode(true)}>
            Chỉnh sửa R5
          </button>
        ) : null}
        {editMode ? (
          <button type="button" className="btn btn-sm btn-link" onClick={() => setEditMode(false)}>
            Xem preview
          </button>
        ) : null}
      </div>

      {editMode && canEdit ? (
        <PresalesR5PlanForm
          planName={planName}
          planNorthStar={planNorthStar}
          planObjectives={planObjectives}
          planStrategy={planStrategy}
          planValidation={planValidation}
          disabled={busy}
          canEdit={canEdit}
          onPlanNameChange={setPlanName}
          onNorthStarChange={setPlanNorthStar}
          onObjectivesChange={setPlanObjectives}
          onStrategyChange={(key, value) => setPlanStrategy((prev) => ({ ...prev, [key]: value }))}
          onSave={() => void onSavePlan()}
        />
      ) : (
        <PresalesR5PreviewPanel
          planName={planName}
          planNorthStar={planNorthStar}
          planObjectives={planObjectives}
          planStrategy={planStrategy}
          planValidation={planValidation}
          stage={stage}
          onEditR5={canEdit ? () => setEditMode(true) : undefined}
        />
      )}
    </section>
  );
}
