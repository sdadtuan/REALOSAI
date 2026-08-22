'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchMktAiPlaybooks,
  postMktAiPlaybookApply,
  type MktAiBrief,
  type MktAiBriefValidation,
  type MktAiPlaybookListResult,
} from '@/lib/mkt-ai-planner-api';

interface Props {
  token: string;
  lifecycleId: number;
  serviceSlug?: string;
  canEdit: boolean;
  paused?: boolean;
  activeSlug?: string | null;
  onApplied: (result: {
    brief: MktAiBrief;
    brief_validation: MktAiBriefValidation;
    playbook_slug: string;
    messages: string[];
  }) => void;
  onError?: (message: string) => void;
}

export function AiPlaybookSelector({
  token,
  lifecycleId,
  serviceSlug,
  canEdit,
  paused = false,
  activeSlug,
  onApplied,
  onError,
}: Props) {
  const [catalog, setCatalog] = useState<MktAiPlaybookListResult | null>(null);
  const [selectedSlug, setSelectedSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMktAiPlaybooks(token, lifecycleId);
      setCatalog(data);
      const next =
        data.active_slug ??
        data.playbooks.find((p) => p.slug === serviceSlug)?.slug ??
        data.playbooks[0]?.slug ??
        '';
      setSelectedSlug(next);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Tải playbook thất bại');
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId, serviceSlug, onError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (activeSlug) setSelectedSlug(activeSlug);
  }, [activeSlug]);

  const selected = useMemo(
    () => catalog?.playbooks.find((p) => p.slug === selectedSlug) ?? null,
    [catalog, selectedSlug],
  );

  async function handleApply(confirmOverwrite = false) {
    if (!canEdit || !selectedSlug) return;
    setBusy(true);
    try {
      const out = await postMktAiPlaybookApply(token, lifecycleId, selectedSlug, {
        confirm_overwrite: confirmOverwrite,
      });
      onApplied(out);
      await reload();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Áp dụng playbook thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Đang tải industry template…
      </p>
    );
  }

  if (!catalog?.playbooks.length) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Industry template chưa bật hoặc chưa có playbook cho dịch vụ pilot.
      </p>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: '0.55rem',
        padding: '0.65rem 0.75rem',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'rgba(57, 139, 67, 0.03)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.9rem' }}>Industry template (playbook)</strong>
        {catalog.active_slug ? (
          <span className="muted" style={{ fontSize: '0.8rem' }}>
            Đang dùng: {catalog.playbooks.find((p) => p.slug === catalog.active_slug)?.label_vi ?? catalog.active_slug}
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={selectedSlug}
          disabled={!canEdit || paused || busy}
          onChange={(e) => setSelectedSlug(e.target.value)}
          style={{
            minWidth: 220,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.45rem 0.65rem',
            color: 'var(--text)',
          }}
        >
          {catalog.playbooks.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.label_vi}
            </option>
          ))}
        </select>
        {canEdit ? (
          <>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!selectedSlug || paused || busy}
              onClick={() => void handleApply(false)}
            >
              Áp dụng template
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={!selectedSlug || paused || busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Ghi đè các trường brief đã có bằng giá trị mặc định của playbook?',
                  )
                ) {
                  void handleApply(true);
                }
              }}
            >
              Ghi đè toàn bộ
            </button>
          </>
        ) : null}
      </div>

      {selected ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
          Launch QA gate: Quality score ≥{selected.quality_gate.min_score_launch_qa}
        </p>
      ) : null}
    </div>
  );
}
