'use client';

import { useEffect, useState } from 'react';
import { fetchAiScoresBatch, type LeadScoreSummary } from '@/lib/ai-api';

export function useLeadScoresMap(
  token: string,
  leadIds: number[],
  enabled: boolean,
): { scores: Record<string, LeadScoreSummary>; pending: boolean } {
  const [scores, setScores] = useState<Record<string, LeadScoreSummary>>({});
  const [pending, setPending] = useState(false);
  const idsKey = leadIds.join(',');

  useEffect(() => {
    if (!enabled || !token || !leadIds.length) {
      setScores({});
      setPending(false);
      return;
    }

    let cancelled = false;
    setPending(true);

    void fetchAiScoresBatch(token, 'lead', leadIds)
      .then((map) => {
        if (!cancelled) {
          setScores(map);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScores({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, token, idsKey]);

  return { scores, pending };
}
