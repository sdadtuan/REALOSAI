'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LeadActivityRow, LeadCopilotContext, LeadRow } from '@/lib/api';
import type { StoredStaffUser } from '@/lib/auth';
import {
  fetchAiScores,
  pollAiScoreUntilReady,
  type AiScoreRecord,
} from '@/lib/ai-api';
import { ApiError } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import { AiErrorBoundary } from './AiErrorBoundary';
import { AiFeatureGate } from './AiFeatureGate';
import { ConfidenceBanner } from './ConfidenceBanner';
import { LeadBriefSection } from './LeadBriefSection';
import { ScoreCard } from './ScoreCard';
import { LeadNbaSection } from './LeadNbaSection';
import { LeadRouteRepSection } from './LeadRouteRepSection';
import { SummarizeSection } from './SummarizeSection';
import { FollowUpDraftSection } from './FollowUpDraftSection';
import { CallScriptDraftSection } from './CallScriptDraftSection';
import { MeetingPrepCopilotSection } from './MeetingPrepCopilotSection';

interface Props {
  token: string;
  leadId: number;
  lead: LeadRow;
  user: StoredStaffUser;
  activities: LeadActivityRow[];
  selectedActivityId?: number | null;
  onSelectActivity?: (id: number | null) => void;
  onCopilotError?: (msg: string) => void;
  onActivityCreated?: () => void;
  variant?: 'column' | 'drawer' | 'sheet';
  onCloseDrawer?: () => void;
  copilotContext?: LeadCopilotContext | null;
  copilotContextLoading?: boolean;
}

export function LeadCopilotPanel({
  token,
  leadId,
  lead,
  user,
  activities,
  selectedActivityId,
  onSelectActivity,
  onCopilotError,
  onActivityCreated,
  variant = 'column',
  onCloseDrawer,
  copilotContext,
  copilotContextLoading = false,
}: Props) {
  const [score, setScore] = useState<AiScoreRecord | null>(null);
  const [scorePending, setScorePending] = useState(true);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadScore = useCallback(async () => {
    setScoreError(null);
    try {
      const out = await fetchAiScores(token, 'lead', leadId, 1);
      if (out.data.latest) {
        setScore(out.data.latest);
        setScorePending(false);
        return;
      }
      setScorePending(true);
      const polled = await pollAiScoreUntilReady(token, leadId);
      setScore(polled);
      setScorePending(!polled);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 403
            ? 'Không có quyền xem điểm lead này.'
            : err.message
          : err instanceof Error
            ? err.message
            : 'Tải điểm thất bại';
      setScoreError(msg);
      setScorePending(false);
      onCopilotError?.(msg);
    }
  }, [token, leadId, onCopilotError]);

  useEffect(() => {
    void loadScore();
  }, [loadScore, reloadKey]);

  async function onRefreshScore() {
    setRefreshing(true);
    try {
      await loadScore();
    } finally {
      setRefreshing(false);
    }
  }

  const confidence = score?.confidence ?? null;

  const panel = (
    <AiFeatureGate user={user}>
      <AiErrorBoundary onRetry={() => setReloadKey((k) => k + 1)}>
        <aside
          className={`ai-copilot-panel${
            variant === 'drawer'
              ? ' ai-copilot-panel--drawer'
              : variant === 'sheet'
                ? ' ai-copilot-panel--sheet'
                : ''
          }`}
          aria-label="AI Copilot"
          data-testid={variant === 'sheet' ? 'lead-copilot-bottom-sheet' : undefined}
        >
          <header className="ai-copilot-panel__header">
            <h3 className="ai-copilot-panel__title">AI Copilot</h3>
            {(variant === 'drawer' || variant === 'sheet') && onCloseDrawer ? (
              <button type="button" className="btn btn-sm btn-secondary" onClick={onCloseDrawer}>
                Đóng
              </button>
            ) : null}
          </header>

          {confidence != null ? <ConfidenceBanner confidence={confidence} /> : null}

          <ScoreCard
            score={score}
            pending={scorePending}
            error={scoreError}
            onRefresh={() => void onRefreshScore()}
            refreshing={refreshing}
            canOverride={hasCap(user, 'crm_leads', 'assign')}
            leadId={leadId}
            token={token}
            onScoreUpdated={(next) => {
              setScore(next);
              setScorePending(false);
            }}
            onError={onCopilotError}
          />

          <LeadRouteRepSection
            token={token}
            leadId={leadId}
            hasOwner={lead.owner_id != null}
            scoreReady={!scorePending && !scoreError}
            onError={onCopilotError}
            onAssigned={onActivityCreated}
          />

          <LeadNbaSection
            token={token}
            leadId={leadId}
            scoreReady={!scorePending && !scoreError}
            onError={onCopilotError}
            onActivityCreated={onActivityCreated}
          />

          <LeadBriefSection token={token} leadId={leadId} onError={onCopilotError} />

          <SummarizeSection
            token={token}
            leadId={leadId}
            activities={activities}
            selectedActivityId={selectedActivityId}
            onSelectActivity={onSelectActivity}
            onError={onCopilotError}
          />

          <CallScriptDraftSection
            token={token}
            leadId={leadId}
            onError={onCopilotError}
            callScript={copilotContext?.sla.drafts.call_script}
            scriptLoading={copilotContextLoading}
          />

          <MeetingPrepCopilotSection
            token={token}
            leadId={leadId}
            copilotContext={copilotContext}
            loading={copilotContextLoading}
          />

          <FollowUpDraftSection
            token={token}
            leadId={leadId}
            onError={onCopilotError}
            onActivityCreated={onActivityCreated}
          />

          <footer className="ai-copilot-panel__footer muted" data-testid="copilot-trust-footer">
            Gợi ý AI — cần bạn duyệt trước khi gửi khách (BR-AI-01). Không thay quyết định con người · Lead #
            {lead.id} · {lead.channel || lead.source || '—'}
          </footer>
        </aside>
      </AiErrorBoundary>
    </AiFeatureGate>
  );

  return panel;
}
