'use client';

import { useEffect, useRef, useState } from 'react';
import {
  fetchResearchJob,
  TRANSITION_REASON_VI,
  type ResearchAiRun,
} from '@/lib/market-research-api';

const TERMINAL = new Set(['succeeded', 'failed']);

type ResearchJobChipProps = {
  token: string | null;
  projectId: number;
  runId: number | null;
  kind?: 'desk' | 'deep' | 'triangulate' | 'pulse' | 'whisper' | 'sparktoro' | 'talkwalker' | 'qualtrics';
  onSettled: (run: ResearchAiRun) => void;
};

export function ResearchJobChip({
  token,
  projectId,
  runId,
  kind = 'desk',
  onSettled,
}: ResearchJobChipProps) {
  const [run, setRun] = useState<ResearchAiRun | null>(null);
  const settledRef = useRef<(run: ResearchAiRun) => void>(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    if (!token || !runId) {
      setRun(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 2000;

    const tick = async () => {
      try {
        const next = await fetchResearchJob(token, projectId, runId);
        if (cancelled) return;
        setRun(next);
        if (TERMINAL.has(next.status)) {
          settledRef.current(next);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      delay = 5000;
      timer = setTimeout(() => void tick(), delay);
    };

    timer = setTimeout(() => void tick(), delay);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, projectId, runId]);

  if (!runId) return null;
  const status = run?.status ?? 'pending';
  const busy = status === 'pending' || status === 'running';
  const noun =
    kind === 'deep'
      ? 'Deep'
      : kind === 'triangulate'
        ? 'Tam giác nguồn'
        : kind === 'pulse'
          ? 'Pulse'
          : kind === 'whisper'
            ? 'Audio'
            : kind === 'sparktoro'
              ? 'SparkToro'
              : kind === 'talkwalker'
                ? 'Talkwalker'
                : kind === 'qualtrics'
                  ? 'Qualtrics'
                  : 'Desk';
  const label =
    status === 'running'
      ? kind === 'deep'
        ? 'Đang Deep Research…'
        : kind === 'triangulate'
          ? 'Đang tam giác nguồn…'
          : kind === 'pulse'
            ? 'Đang chạy pulse…'
            : kind === 'whisper'
              ? 'Đang cắt excerpt…'
              : kind === 'sparktoro'
                ? 'Đang lấy nguồn SparkToro…'
                : kind === 'talkwalker'
                  ? 'Đang lấy nguồn Talkwalker…'
                  : kind === 'qualtrics'
                    ? 'Đang export Qualtrics…'
                    : 'Đang lấy nguồn…'
      : status === 'pending'
        ? `${noun} đang chờ`
        : status === 'succeeded'
          ? `${noun} xong`
          : TRANSITION_REASON_VI[run?.error_message ?? ''] ?? run?.error_message ?? `${noun} thất bại`;

  return (
    <span
      aria-busy={busy}
      title={run?.error_message ?? status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '0.15rem 0.55rem',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--primary) 12%, white)',
        fontSize: '0.8rem',
      }}
    >
      {busy ? '● ' : ''}
      {label}
    </span>
  );
}
