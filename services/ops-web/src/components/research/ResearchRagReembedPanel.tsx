'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  previewResearchRagReembed,
  ResearchApiError,
  startResearchRagReembed,
  type RagReembedPreview,
  type RagReembedStart,
} from '@/lib/market-research-api';
import {
  clampRagReembedLimit,
  formatRagReembedResult,
  mapRagReembedErrorCode,
  RAG_REEMBED_BANNER,
  RAG_REEMBED_DEFAULT_LIMIT,
  RAG_REEMBED_RUNBOOK_PATH,
} from '@/components/research/research-rag-reembed.util';

type ResearchRagReembedPanelProps = {
  token: string;
};

export function ResearchRagReembedPanel({ token }: ResearchRagReembedPanelProps) {
  const [preview, setPreview] = useState<RagReembedPreview | null>(null);
  const [result, setResult] = useState<RagReembedStart | null>(null);
  const [limit, setLimit] = useState(RAG_REEMBED_DEFAULT_LIMIT);
  const [error, setError] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [running, setRunning] = useState(false);

  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    setError('');
    try {
      const out = await previewResearchRagReembed(token);
      setPreview(out);
    } catch (err) {
      setPreview(null);
      const api = err instanceof ResearchApiError ? err : null;
      setError(mapRagReembedErrorCode(api?.code) || (err instanceof Error ? err.message : 'Preview thất bại'));
    } finally {
      setLoadingPreview(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function handleRun() {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const out = await startResearchRagReembed(token, { limit: clampRagReembedLimit(limit) });
      setResult(out);
      await loadPreview();
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      setError(mapRagReembedErrorCode(api?.code) || (err instanceof Error ? err.message : 'Batch thất bại'));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section data-testid="rag-reembed-panel" className="stack-gap" style={{ marginTop: '1rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.05rem' }}>RAG re-embed backfill</h2>
      <p
        className="muted"
        style={{
          margin: 0,
          padding: '0.45rem 0.55rem',
          borderRadius: 8,
          fontSize: '0.82rem',
          background: 'rgba(100, 116, 139, 0.12)',
          color: '#334155',
        }}
      >
        {RAG_REEMBED_BANNER} Runbook: {RAG_REEMBED_RUNBOOK_PATH}
      </p>

      {loadingPreview ? <p className="muted">Đang tải preview…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {preview ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Insight cần re-embed:{' '}
          <strong data-testid="rag-reembed-preview-count">{preview.stale_count}</strong> · Mục tiêu{' '}
          {preview.target_dims}-d ({preview.target_model})
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
          Batch limit
          <input
            data-testid="rag-reembed-limit"
            type="number"
            className="kpi-input"
            min={1}
            max={200}
            value={limit}
            disabled={running}
            onChange={(e) => setLimit(clampRagReembedLimit(Number(e.target.value)))}
            style={{ width: '5rem' }}
          />
        </label>
        <button
          type="button"
          className="btn btn-sm"
          data-testid="rag-reembed-run"
          disabled={running || loadingPreview}
          onClick={() => void handleRun()}
        >
          {running ? 'Đang chạy…' : 'Chạy batch'}
        </button>
      </div>

      {result ? (
        <p data-testid="rag-reembed-result" className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          {formatRagReembedResult(result)}
        </p>
      ) : null}
    </section>
  );
}
