'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAiRecommendations,
  patchAiRecommendation,
  postAiRouteLead,
  type RouteLeadResponse,
} from '@/lib/ai-api';
import { DismissReasonModal } from '@/components/ai/DismissReasonModal';
import { RouteRepCard } from '@/components/ai/RouteRepCard';

interface Props {
  token: string;
  leadId: number;
  hasOwner: boolean;
  scoreReady?: boolean;
  onError?: (msg: string) => void;
  onAssigned?: () => void;
}

export function LeadRouteRepSection({
  token,
  leadId,
  hasOwner,
  scoreReady = true,
  onError,
  onAssigned,
}: Props) {
  const [route, setRoute] = useState<RouteLeadResponse['data'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDismiss, setShowDismiss] = useState(false);

  const loadRoute = useCallback(async () => {
    if (!scoreReady || hasOwner) return;
    setLoading(true);
    setMessage(null);
    try {
      const recs = await fetchAiRecommendations(token, 'lead', leadId, { status: 'pending', limit: 8 });
      const pending = recs.data.recommendations.find((r) => r.recommendation_type === 'route_rep');
      if (pending) {
        const actionJson = (pending.action_json ?? {}) as Record<string, unknown>;
        setRoute({
          recommendation_id: String(pending.id),
          lead_id: leadId,
          recommended_staff_id: Number(actionJson.recommended_staff_id ?? 0),
          recommended_staff_name: String(actionJson.recommended_staff_name ?? ''),
          recommended_staff_code: String(actionJson.recommended_staff_code ?? ''),
          strategy: String(actionJson.strategy ?? 'project_pool') as RouteLeadResponse['data']['strategy'],
          reason: String(actionJson.reason ?? pending.recommendation_text),
          confidence: Number(pending.confidence ?? 0.65),
          status: String(pending.status ?? 'pending'),
          recommendation_text: String(pending.recommendation_text ?? ''),
          agent_run_id: String(pending.agent_run_id ?? ''),
        });
        return;
      }
      try {
        const out = await postAiRouteLead(token, leadId);
        setRoute(out.data);
      } catch {
        setRoute(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không tải gợi ý routing';
      onError?.(msg);
      setRoute(null);
    } finally {
      setLoading(false);
    }
  }, [hasOwner, leadId, onError, scoreReady, token]);

  useEffect(() => {
    void loadRoute();
  }, [loadRoute]);

  async function onAccept() {
    if (!route) return;
    setBusy(true);
    setMessage(null);
    try {
      await patchAiRecommendation(token, route.recommendation_id, { status: 'accepted' });
      setMessage('Đã phân lead theo gợi ý AI.');
      setRoute(null);
      onAssigned?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Phân lead thất bại';
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onDismissConfirm(reason: string) {
    if (!route) return;
    setBusy(true);
    try {
      await patchAiRecommendation(token, route.recommendation_id, {
        status: 'dismissed',
        dismiss_reason: reason,
      });
      setShowDismiss(false);
      setRoute(null);
      setMessage('Đã bỏ gợi ý routing.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bỏ routing thất bại';
      onError?.(msg);
    } finally {
      setBusy(false);
    }
  }

  if (hasOwner) {
    return null;
  }

  if (loading && !route) {
    return (
      <section className="nba-card nba-card--loading" aria-busy="true" aria-label="Lead routing">
        <p className="muted">Đang gợi ý NV phân lead…</p>
      </section>
    );
  }

  if (!route) {
    return message ? <p className="ai-followup-message">{message}</p> : null;
  }

  return (
    <>
      {message ? <p className="ai-followup-message">{message}</p> : null}
      <RouteRepCard
        staffName={route.recommended_staff_name}
        staffCode={route.recommended_staff_code}
        strategy={route.strategy}
        reason={route.reason}
        confidence={route.confidence}
        loading={busy}
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
