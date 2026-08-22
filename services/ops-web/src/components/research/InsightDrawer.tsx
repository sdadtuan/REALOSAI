'use client';

import { useEffect, useState } from 'react';
import { ConfidenceRubric, EMPTY_RUBRIC } from '@/components/research/ConfidenceRubric';
import { EvidenceIdChip } from '@/components/research/EvidenceIdChip';
import { InsightStaleBanner } from '@/components/research/InsightStaleBanner';
import { insightIsStale } from '@/components/research/insight-stale.util';
import {
  canSubmitInsightReview,
  fetchResearchTaxonomy,
  hasPersistedInsightRubric,
  insightConfidencePayload,
  INSIGHT_GATE_COPY,
  INSIGHT_STATUS_LABELS,
  type ConfidenceBand,
  type ConfidenceJson,
  type ConfidenceRubric as ConfidenceRubricValue,
  type CreateInsightBody,
  type ResearchEvidence,
  type ResearchInsight,
  type ResearchTaxonomyTheme,
} from '@/lib/market-research-api';
import { getAccessToken } from '@/lib/auth';
import { TAXONOMY_BANNER } from './taxonomy-pane.util';

const BLOCKS = [
  { id: 'observation', label: 'Quan sát' },
  { id: 'interpretation', label: 'Diễn giải' },
  { id: 'implication', label: 'Hệ quả' },
  { id: 'recommendation', label: 'Khuyến nghị' },
] as const;

type BlockId = (typeof BLOCKS)[number]['id'];

const empty = {
  statement: '',
  observation: '',
  interpretation: '',
  implication: '',
  recommendation: '',
  audience: '',
  confidence_rationale: '',
  valid_from: '',
  valid_to: '',
};

function rubricFromInsight(insight: ResearchInsight | null): ConfidenceRubricValue {
  const raw = insight?.confidence_json;
  if (!raw || typeof raw !== 'object') return { ...EMPTY_RUBRIC };
  const nested = 'rubric' in raw && raw.rubric && typeof raw.rubric === 'object' ? raw.rubric : raw;
  const src = nested as ConfidenceRubricValue;
  return {
    S: Number(src.S) || 0,
    F: Number(src.F) || 0,
    T: Number(src.T) || 0,
    A: Number(src.A) || 0,
    R: Number(src.R) || 0,
    statistical_inference: Boolean(src.statistical_inference),
  };
}

function bandFromInsight(insight: ResearchInsight | null): ConfidenceBand | null {
  const raw = insight?.confidence_json;
  if (!raw || typeof raw !== 'object' || !('band' in raw)) return null;
  const band = (raw as ConfidenceJson).band;
  if (band === 'low' || band === 'medium' || band === 'high' || band === 'very_high') return band;
  return null;
}

export function InsightDrawer({
  open,
  insight,
  evidence,
  canEdit,
  canApprove,
  isCreator,
  saving,
  onClose,
  onSave,
  onSubmitReview,
  onApprove,
  onAttachTheme,
}: {
  open: boolean;
  insight: ResearchInsight | null;
  evidence: ResearchEvidence[];
  canEdit: boolean;
  canApprove: boolean;
  isCreator: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (body: CreateInsightBody, evidenceIds: number[]) => Promise<void>;
  onSubmitReview: (body: CreateInsightBody, evidenceIds: number[]) => Promise<void>;
  onApprove: (target: 'approved_internal' | 'approved_client_facing') => Promise<void>;
  onAttachTheme?: (taxonomyId: number) => Promise<void>;
}) {
  const [form, setForm] = useState(empty);
  const [rubric, setRubric] = useState<ConfidenceRubricValue>({ ...EMPTY_RUBRIC });
  const [rubricTouched, setRubricTouched] = useState(false);
  const [block, setBlock] = useState<BlockId>('observation');
  const [selected, setSelected] = useState<number[]>([]);
  const [themes, setThemes] = useState<ResearchTaxonomyTheme[]>([]);
  const [taxonomyId, setTaxonomyId] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      statement: insight?.statement ?? '',
      observation: insight?.observation ?? '',
      interpretation: insight?.interpretation ?? '',
      implication: insight?.implication ?? '',
      recommendation: insight?.recommendation ?? '',
      audience: insight?.audience ?? '',
      confidence_rationale: insight?.confidence_rationale ?? '',
      valid_from: insight?.valid_from ?? '',
      valid_to: insight?.valid_to ?? '',
    });
    setRubric(rubricFromInsight(insight));
    setRubricTouched(false);
    setSelected(insight?.evidence_ids ?? []);
    setBlock('observation');
    setTaxonomyId('');
  }, [open, insight]);

  useEffect(() => {
    if (!open || !canEdit) return;
    const token = getAccessToken();
    if (!token) return;
    void fetchResearchTaxonomy(token)
      .then((out) => setThemes(out.themes.filter((theme) => theme.active)))
      .catch(() => setThemes([]));
  }, [open, canEdit]);

  if (!open) return null;

  const verified = evidence.filter((ev) => ev.qc_status === 'verified');
  const verifiedSelected = selected.filter((id) => verified.some((ev) => ev.id === id));
  const canSubmit = canSubmitInsightReview(insight?.status);
  const submitDisabled = saving || !canSubmit || !form.statement.trim() || verifiedSelected.length < 1;
  const showInternalApprove =
    canApprove && !isCreator && (insight?.status === 'analyst_verified' || insight?.status === 'peer_reviewed');
  const showClientApprove = canApprove && !isCreator && insight?.status === 'approved_internal';

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toBody(): CreateInsightBody {
    const body: CreateInsightBody = {
      statement: form.statement.trim(),
      observation: form.observation.trim() || null,
      interpretation: form.interpretation.trim() || null,
      implication: form.implication.trim() || null,
      recommendation: form.recommendation.trim() || null,
      audience: form.audience.trim() || null,
      confidence_rationale: form.confidence_rationale.trim() || null,
      valid_from: form.valid_from.trim() || null,
      valid_to: form.valid_to.trim() || null,
    };
    const confidence_json = insightConfidencePayload(rubric, {
      touched: rubricTouched,
      hasStoredRubric: insight ? hasPersistedInsightRubric(insight) : false,
    });
    if (confidence_json !== undefined) body.confidence_json = confidence_json;
    return body;
  }

  function toggleEvidence(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const title = insight ? `Insight #${insight.id} · ${INSIGHT_STATUS_LABELS[insight.status]}` : 'Insight mới';
  const stale = insight ? insightIsStale(insight) : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 28, 20, 0.35)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 40,
      }}
      onClick={onClose}
    >
      <form
        className="card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!canEdit) return;
          void onSave(toBody(), selected);
        }}
        style={{
          width: 'min(520px, 100%)',
          height: '100%',
          overflow: 'auto',
          padding: '1rem',
          display: 'grid',
          gap: '0.55rem',
          alignContent: 'start',
          borderRadius: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h2>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
            Đóng
          </button>
        </div>
        {isCreator ? (
          <p className="muted">Người tạo không tự duyệt — nhờ Research Lead.</p>
        ) : null}
        {stale ? <InsightStaleBanner validTo={insight?.valid_to} /> : null}
        <label>
          Statement *
          <textarea
            className="kpi-input"
            rows={3}
            required
            value={form.statement}
            disabled={!canEdit}
            onChange={(e) => set('statement', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {canEdit && insight && onAttachTheme ? (
          <fieldset style={{ border: '1px solid #d8e0d8', borderRadius: 8, padding: '0.6rem' }}>
            <legend>Theme</legend>
            <p className="muted" style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
              {TAXONOMY_BANNER}
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ flex: '1 1 12rem' }}>
                Gắn theme
                <select
                  className="kpi-input"
                  value={taxonomyId}
                  disabled={saving}
                  onChange={(e) => setTaxonomyId(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                >
                  <option value="">Chọn theme</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={String(theme.id)}>
                      {theme.theme_code} — {theme.label_vi}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-sm"
                disabled={saving || !taxonomyId}
                onClick={() => void onAttachTheme(Number(taxonomyId))}
              >
                Lưu
              </button>
            </div>
          </fieldset>
        ) : null}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {BLOCKS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={block === b.id ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
              onClick={() => setBlock(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <label>
          {BLOCKS.find((b) => b.id === block)?.label}
          <textarea
            className="kpi-input"
            rows={4}
            value={form[block]}
            disabled={!canEdit}
            onChange={(e) => set(block, e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <fieldset style={{ border: '1px solid #d8e0d8', borderRadius: 8, padding: '0.6rem' }}>
          <legend>Evidence đã verify</legend>
          {verified.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              Chưa có evidence verified để gắn.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {verified.map((ev) => (
                <li key={ev.id} style={{ marginBottom: '0.35rem' }}>
                  <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selected.includes(ev.id)}
                      disabled={!canEdit}
                      onChange={() => toggleEvidence(ev.id)}
                    />
                    <EvidenceIdChip id={ev.id} locator={ev.locator} />
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {ev.excerpt || ev.locator}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <label>
          Giải thích độ tin cậy
          <textarea
            className="kpi-input"
            rows={3}
            value={form.confidence_rationale}
            disabled={!canEdit}
            onChange={(e) => set('confidence_rationale', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <ConfidenceRubric
          value={rubric}
          band={bandFromInsight(insight)}
          disabled={!canEdit}
          onChange={(next) => {
            setRubricTouched(true);
            setRubric(next);
          }}
        />
        <label>
          Audience
          <input
            className="kpi-input"
            value={form.audience}
            disabled={!canEdit}
            onChange={(e) => set('audience', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label>
            Hiệu lực từ
            <input
              className="kpi-input"
              type="date"
              value={form.valid_from}
              disabled={!canEdit}
              onChange={(e) => set('valid_from', e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Đến
            <input
              className="kpi-input"
              type="date"
              value={form.valid_to}
              disabled={!canEdit}
              onChange={(e) => set('valid_to', e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {canEdit ? (
            <button type="submit" className="btn btn-sm" disabled={saving || !form.statement.trim()}>
              Lưu
            </button>
          ) : null}
          {canEdit && canSubmit ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={submitDisabled}
              title={verifiedSelected.length < 1 ? INSIGHT_GATE_COPY.missing_verified_evidence : undefined}
              onClick={() => void onSubmitReview(toBody(), selected)}
            >
              Gửi Lead duyệt
            </button>
          ) : null}
          {showInternalApprove ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving}
              onClick={() => void onApprove('approved_internal')}
            >
              Duyệt nội bộ
            </button>
          ) : null}
          {showClientApprove ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={saving}
              onClick={() => void onApprove('approved_client_facing')}
            >
              Duyệt bản khách
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
