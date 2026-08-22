'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { getAccessToken, hasCap, type StoredStaffUser } from '@/lib/auth';
import {
  b2bLeadAlertsStreamUrl,
  fetchB2bLeadAlerts,
  parseB2bLeadAlerts,
  type B2bLeadAlertRow,
} from '@/lib/b2b-lead-alerts-api';
import {
  isB2bHotSoundEnabled,
  isB2bSalesInHours,
  registerB2bStaffPush,
  shouldRingHotAlarm,
} from '@/lib/b2b-hot-alarm';

const POLL_MS = 15_000;

function leadDetailOpen(pathname: string, leadId: number): boolean {
  return pathname === `/crm/leads/${leadId}` || pathname.startsWith(`/crm/leads/${leadId}/`);
}

function pickUrgent(items: B2bLeadAlertRow[], pathname: string): B2bLeadAlertRow | null {
  return (
    items.find(
      (row) =>
        row.severity === 'urgent' && !row.read_at && !leadDetailOpen(pathname, row.lead_id),
    ) ?? null
  );
}

export function B2bHotAlarm({ user }: { user: StoredStaffUser | null }) {
  const pathname = usePathname();
  const ringStartRef = useRef<number | null>(null);
  const urgentRef = useRef<B2bLeadAlertRow | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const stopTone = useCallback(() => {
    try {
      oscRef.current?.stop();
    } catch {
      // already stopped
    }
    oscRef.current = null;
    gainRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    ringStartRef.current = null;
  }, []);

  const startTone = useCallback(() => {
    if (!isB2bHotSoundEnabled() || typeof window === 'undefined') return;
    if (oscRef.current) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      audioCtxRef.current = ctx;
      oscRef.current = osc;
      gainRef.current = gain;
    } catch {
      // autoplay policy or missing Web Audio
    }
  }, []);

  const syncRing = useCallback(
    (urgent: B2bLeadAlertRow | null) => {
      if (!urgent) {
        stopTone();
        return;
      }
      const leadOpen = leadDetailOpen(pathname, urgent.lead_id);
      if (leadOpen) {
        stopTone();
        return;
      }
      if (ringStartRef.current == null) {
        ringStartRef.current = Date.now();
      }
      const elapsedMs = Date.now() - ringStartRef.current;
      const ring = shouldRingHotAlarm({
        severity: urgent.severity,
        inHours: isB2bSalesInHours(),
        leadOpen,
        elapsedMs,
      });
      if (ring) {
        startTone();
      } else {
        stopTone();
      }
    },
    [pathname, startTone, stopTone],
  );

  const applyItems = useCallback(
    (items: B2bLeadAlertRow[]) => {
      const urgent = pickUrgent(items, pathname);
      urgentRef.current = urgent;
      if (!urgent) ringStartRef.current = null;
      syncRing(urgent);
    },
    [pathname, syncRing],
  );

  useEffect(() => {
    if (!user || !hasCap(user, 'crm_leads', 'view')) return;

    let cancelled = false;
    let eventSource: EventSource | null = null;
    let pollTimer: number | undefined;

    async function poll() {
      const token = getAccessToken();
      if (!token || cancelled) return;
      try {
        const items = await fetchB2bLeadAlerts(token, { limit: 30 });
        if (cancelled) return;
        applyItems(items);
      } catch {
        // ignore transient errors
      }
    }

    const token = getAccessToken();
    if (token) {
      void registerB2bStaffPush(token);
    }

    if (token && typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource(b2bLeadAlertsStreamUrl(token));
        eventSource.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as {
              changed?: boolean;
              items?: unknown;
            };
            if (payload.changed && payload.items) {
              applyItems(parseB2bLeadAlerts(payload.items));
            }
          } catch {
            // ignore malformed SSE payload
          }
        };
        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
        };
      } catch {
        eventSource = null;
      }
    }

    void poll();
    pollTimer = window.setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      eventSource?.close();
      if (pollTimer) window.clearInterval(pollTimer);
      stopTone();
    };
  }, [user, applyItems, stopTone]);

  useEffect(() => {
    syncRing(urgentRef.current);
  }, [pathname, syncRing]);

  return null;
}
