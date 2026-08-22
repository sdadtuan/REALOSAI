'use client';

import { useCallback, useEffect, useState } from 'react';
import { CrmFunnelStepper } from '@/components/crm/funnel-stepper';
import {
  advanceLeadPresales,
  claimLeadSolution,
  fetchIntakeSessions,
  fetchLeadPresalesConsultGate,
  fetchLeadPresalesProposalGate,
  handoffLeadToSolution,
  releaseLeadToSales,
  type LeadFunnelSnapshot,
} from '@/lib/api';
import type {
  ConsultGateState,
  FunnelPrimaryAction,
  IntakeStepSummary,
  ProposalGateState,
} from '@/lib/crm/funnel-stepper.types';
import { showPresalesForFlow } from '@/lib/crm/lead-flow-kind';
import {
  resolvePresalesSolutionCaps,
  type PresalesSolutionCaps,
} from '@/lib/crm/presales-solution-caps';
import type { StoredStaffUser } from '@/lib/auth';

interface Props {
  token: string;
  leadId: number;
  user?: StoredStaffUser | null;
  funnel: LeadFunnelSnapshot | null;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onOpenConsultWorkspace?: () => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
}

function buildIntakeSummary(sessions: Awaited<ReturnType<typeof fetchIntakeSessions>>): IntakeStepSummary {
  const hasDraft = sessions.some((s) => s.status === 'draft');
  const latestCompleted = [...sessions]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => b.id - a.id)[0];
  return {
    has_draft: hasDraft,
    latest_completed: latestCompleted
      ? {
          id: latestCompleted.id,
          decision: latestCompleted.decision ?? '',
          bant_total: Number(latestCompleted.bant_total ?? 0),
          completed_at: latestCompleted.updated_at ?? '',
        }
      : undefined,
  };
}

function scrollToPresalesPanel() {
  if (typeof window === 'undefined') return;
  const el = document.getElementById('funnel-presales');
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function navigateToPresales(onOpenConsultWorkspace?: () => void) {
  if (onOpenConsultWorkspace) {
    onOpenConsultWorkspace();
    return;
  }
  scrollToPresalesPanel();
}

export function LeadPresalesFunnelStepper({
  token,
  leadId,
  user,
  funnel,
  onFunnelChange,
  onOpenConsultWorkspace,
  onMessage,
  onError,
}: Props) {
  const solutionCaps: PresalesSolutionCaps = resolvePresalesSolutionCaps(user ?? null);
  const [consultGate, setConsultGate] = useState<ConsultGateState | null>(null);
  const [proposalGate, setProposalGate] = useState<ProposalGateState | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [intakeSummary, setIntakeSummary] = useState<IntakeStepSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshGateAndIntake = useCallback(async () => {
    if (leadId <= 0 || !funnel?.presales_on_lead_enabled) {
      setConsultGate(null);
      setProposalGate(null);
      setIntakeSummary(null);
      return;
    }
    if (!showPresalesForFlow(funnel.lead_flow_kind ?? 'b2b_prospect')) {
      setConsultGate(null);
      setProposalGate(null);
      setIntakeSummary(null);
      return;
    }

    const stage = funnel.presales?.presales.stage;
    setGateLoading(true);
    try {
      const [gateOut, sessions] = await Promise.all([
        fetchLeadPresalesConsultGate(token, leadId).catch(() => null),
        fetchIntakeSessions(token, { lead_id: leadId }).catch(() => []),
      ]);
      setConsultGate(gateOut?.gate ?? null);
      setIntakeSummary(buildIntakeSummary(sessions));

      if (stage === 'consult') {
        const propOut = await fetchLeadPresalesProposalGate(token, leadId).catch(() => null);
        setProposalGate(propOut?.gate ?? null);
      } else {
        setProposalGate(null);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tải gate Intake thất bại');
      setConsultGate(null);
      setProposalGate(null);
      setIntakeSummary(null);
    } finally {
      setGateLoading(false);
    }
  }, [token, leadId, funnel?.presales_on_lead_enabled, funnel?.lead_flow_kind, onError]);

  useEffect(() => {
    void refreshGateAndIntake();
  }, [refreshGateAndIntake, funnel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#funnel-presales') return;
    navigateToPresales(onOpenConsultWorkspace);
  }, [funnel?.presales?.presales.stage, funnel?.presales?.presales.id, onOpenConsultWorkspace]);

  async function onPrimaryAction(action: FunnelPrimaryAction) {
    if (action.kind === 'ensure_presales') {
      navigateToPresales(onOpenConsultWorkspace);
      onMessage?.('Chọn dịch vụ và bấm Bắt đầu pre-sales bên dưới');
      return;
    }

    if (action.kind === 'anchor') {
      navigateToPresales(onOpenConsultWorkspace);
      return;
    }

    if (action.kind !== 'advance_presales' && action.kind !== 'handoff_solution' && action.kind !== 'claim_solution' && action.kind !== 'release_to_sales') {
      return;
    }

    setBusy(true);
    try {
      let overrideReason: string | undefined;
      if (action.requiresOverride) {
        const reason = window.prompt('Director override — nhập lý do:');
        if (!reason?.trim()) {
          onError?.('Cần lý do override');
          return;
        }
        overrideReason = reason.trim();
      }

      let out: { funnel: LeadFunnelSnapshot };
      if (action.kind === 'handoff_solution') {
        out = await handoffLeadToSolution(token, leadId, {
          confirm: true,
          override_reason: overrideReason,
        });
        onMessage?.('Đã giao Solution/MKT');
      } else if (action.kind === 'claim_solution') {
        out = await claimLeadSolution(token, leadId);
        onMessage?.('Đã nhận case Solution');
      } else if (action.kind === 'release_to_sales') {
        out = await releaseLeadToSales(token, leadId);
        onMessage?.('Đã trả Sales — sẵn sàng Báo giá');
      } else {
        out = await advanceLeadPresales(token, leadId, {
          confirm: true,
          override_reason: overrideReason,
        });
        onMessage?.('Đã chuyển giai đoạn pre-sales');
      }
      onFunnelChange?.(out.funnel);
      await refreshGateAndIntake();
      navigateToPresales(onOpenConsultWorkspace);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Thao tác pre-sales thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!funnel?.presales_on_lead_enabled || !showPresalesForFlow(funnel.lead_flow_kind ?? 'b2b_prospect')) {
    return null;
  }

  return (
    <CrmFunnelStepper
      leadId={leadId}
      funnel={funnel}
      consultGate={consultGate}
      proposalGate={proposalGate}
      consultProposalSla={funnel?.presales?.consult_proposal_sla ?? null}
      intakeSummary={intakeSummary}
      solutionCaps={solutionCaps}
      context="lead_detail"
      gateLoading={gateLoading}
      actionBusy={busy}
      className="crm-funnel-stepper--lead-detail"
      onRefreshGate={() => void refreshGateAndIntake()}
      onPrimaryAction={(action) => void onPrimaryAction(action)}
    />
  );
}
