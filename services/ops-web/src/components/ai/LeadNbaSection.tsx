'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAiRecommendations,
  patchAiRecommendation,
  postAiNextBestAction,
  type NextBestActionResponse,
} from '@/lib/ai-api';
import { DismissReasonModal } from '@/components/ai/DismissReasonModal';
import { NbaCard } from '@/components/ai/NbaCard';

interface Props {
  token: string;
  leadId: number;
  scoreReady?: boolean;
  onError?: (msg: string) => void;
  onActivityCreated?: () => void;
}

export function LeadNbaSection({ token, leadId, scoreReady = true, onError, onActivityCreated }: Props) {
  const [nba, setNba] = useState<NextBestActionResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDismiss, setShowDismiss] = useState(false);

  const loadNba = useCallback(async () => {
    if (!scoreReady) return;
    setLoading(true);
    setMessage(null);
    try {
      const recs = await fetchAiRecommendations(token, 'lead', leadId, { status: 'pending', limit: 5 });
      const pending = recs.data.recommendations.find((r) => r.recommendation_type === 'nba');
      if (pending) {
        const actionJson = (pending.action_json ?? {}) as Record<string, unknown>;
        setNba({
          recommendation_id: String(pending.id),
          entity_type: 'lead',
          entity_id: leadId,
          lead_id: leadId,
          action: String(actionJson.action ?? 'call_back'),
          action_label: String(actionJson.action_label ?? 'Gọi lại khách'),
          reason: String(actionJson.reason ?? pending.recommendation_text),
          confidence: Number(pending.confidence ?? 0.6),
          status: String(pending.status ?? 'pending'),
          recommendation_text: String(pending.recommendation_text ?? ''),
          agent_run_id: String(pending.agent_run_id ?? ''),
          playbook_citation: normalizeCitation(actionJson.playbook_citation),
        });
        return;
      }
      try {
        const out = await postAiNextBestAction(token, { lead_id: leadId, entity_type: 'lead' });
        setNba(out.data);
      } catch {
        setNba(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không tải NBA';
      onError?.(msg);
      setNba(null);
    } finally {
      setLoading(false);
    }
  }, [leadId, onError, scoreReady, token]);

  useEffect(() => {
    void loadNba();
  }, [loadNba]);

  async function onAccept() {
    if (!nba) return;
    setBusy(true);
    setMessage(null);
    try {
      await patchAiRecommendation(token, nba.recommendation_id, { status: 'accepted' });
      setMessage('Đã chấp nhận NBA — ghi activity note.');
      setNba(null);
      onActivityCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chấp nhận NBA thất bại';
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onDismissConfirm(reason: string) {
    if (!nba) return;
    setBusy(true);
    try {
      await patchAiRecommendation(token, nba.recommendation_id, {
        status: 'dismissed',
        dismiss_reason: reason,
      });
      setShowDismiss(false);
      setNba(null);
      setMessage('Đã bỏ gợi ý NBA.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bỏ NBA thất bại';
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading && !nba) {
    return (
      <section className="nba-card nba-card--loading" aria-busy="true" aria-label="Next best action">
        <p className="muted">Đang kiểm tra gợi ý NBA…</p>
      </section>
    );
  }

  if (!nba) {
    return message ? <p className="ai-followup-message">{message}</p> : null;
  }

  return (
    <>
      {message ? <p className="ai-followup-message">{message}</p> : null}
      <NbaCard
        actionLabel={nba.action_label}
        reason={nba.reason}
        confidence={nba.confidence}
        loading={busy}
        playbookCitation={nba.playbook_citation}
        onAccept={() => void onAccept()}
        onDismiss={() => setShowDismiss(true)}
      />
      <DismissReasonModal
        open={showDismiss}
        busy={busy}
        onCancel={() => setShowDismiss(false)}
        onConfirm={(reason) => void onDismissConfirm(reason)}
      />
    </>
  );
}

function normalizeCitation(raw: unknown): NextBestActionResponse['data']['playbook_citation'] {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  if (!c.playbook_id || !c.playbook_title) return null;
  return {
    playbook_id: String(c.playbook_id),
    playbook_title: String(c.playbook_title),
    chunk_id: String(c.chunk_id ?? ''),
    chunk_title: String(c.chunk_title ?? ''),
    excerpt: String(c.excerpt ?? ''),
  };
}
