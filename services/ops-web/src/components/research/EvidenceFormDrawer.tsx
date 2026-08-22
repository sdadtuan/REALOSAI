'use client';

import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  fetchResearchStudies,
  type CreateEvidenceBody,
  type ResearchEvidence,
  type ResearchQuestion,
  type ResearchSource,
  type ResearchStudy,
} from '@/lib/market-research-api';

type Mode = 'create' | 'edit' | 'supersede';

type EvidenceFormDrawerProps = {
  open: boolean;
  mode: Mode;
  canEdit: boolean;
  saving: boolean;
  projectId: number;
  sources: ResearchSource[];
  questions: ResearchQuestion[];
  source?: ResearchSource | null;
  evidence?: ResearchEvidence | null;
  piiWarning?: boolean;
  onClose: () => void;
  onSave: (body: CreateEvidenceBody) => Promise<void>;
  onVerify?: (evidence: ResearchEvidence) => Promise<void>;
};

const empty = {
  locator: '',
  excerpt: '',
  value_num: '',
  unit: '',
  value_base: '',
  period_note: '',
  geography: '',
  pii_class: '',
  source_id: '',
  study_id: '',
  question_id: '',
};

export function EvidenceFormDrawer({
  open,
  mode,
  canEdit,
  saving,
  projectId,
  sources,
  questions,
  source,
  evidence,
  piiWarning,
  onClose,
  onSave,
  onVerify,
}: EvidenceFormDrawerProps) {
  const [form, setForm] = useState(empty);
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const locked =
    mode === 'edit' &&
    (evidence?.qc_status === 'verified' ||
      evidence?.qc_status === 'superseded' ||
      evidence?.qc_status === 'rejected');

  useEffect(() => {
    if (!open) return;
    setForm({
      locator: evidence?.locator ?? '',
      excerpt: evidence?.excerpt ?? '',
      value_num: evidence?.value_num != null ? String(evidence.value_num) : '',
      unit: evidence?.unit ?? '',
      value_base: evidence?.value_base ?? '',
      period_note: evidence?.period_note ?? '',
      geography: evidence?.geography ?? '',
      pii_class: evidence?.pii_class && evidence.pii_class !== 'none' ? evidence.pii_class : '',
      source_id: String(source?.id ?? evidence?.source_id ?? ''),
      study_id: evidence?.study_id != null ? String(evidence.study_id) : '',
      question_id: String(source?.question_id ?? evidence?.question_id ?? ''),
    });
    const token = getAccessToken();
    if (!token || !projectId) return;
    void fetchResearchStudies(token, projectId)
      .then((out) => setStudies(out.studies))
      .catch(() => setStudies([]));
  }, [open, source, evidence, projectId]);

  if (!open) return null;

  function set<K extends keyof typeof empty>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toBody(): CreateEvidenceBody {
    return {
      source_id: form.source_id ? Number(form.source_id) : null,
      study_id: form.study_id ? Number(form.study_id) : null,
      question_id: form.question_id ? Number(form.question_id) : null,
      locator: form.locator.trim(),
      excerpt: form.excerpt.trim() || null,
      value_num: form.value_num.trim() === '' ? null : Number(form.value_num),
      unit: form.unit.trim() || null,
      value_base: form.value_base.trim() || null,
      period_note: form.period_note.trim() || null,
      geography: form.geography.trim() || null,
      pii_class: form.pii_class.trim() || null,
    };
  }

  const title =
    mode === 'supersede' ? 'Thay thế evidence (supersede)' : mode === 'edit' ? 'Evidence' : 'Tạo evidence';

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
          if (locked) return;
          void onSave(toBody());
        }}
        style={{
          width: 'min(480px, 100%)',
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
        {locked ? (
          <p className="muted">Đã verify — không sửa excerpt. Dùng Thay thế (supersede).</p>
        ) : (
          <p className="muted">Locator bắt buộc. Excerpt ≤ 500 hoặc value + unit + base. Study dùng locator T-12:03.</p>
        )}
        {piiWarning ? (
          <p className="muted">Phát hiện email/SĐT trong excerpt — đã gắn pii_class = internal.</p>
        ) : null}
        <label>
          Study
          <select
            className="kpi-input"
            value={form.study_id}
            disabled={locked || !canEdit}
            onChange={(e) => set('study_id', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          >
            <option value="">—</option>
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nguồn {form.study_id ? '' : '*'}
          <select
            className="kpi-input"
            value={form.source_id}
            disabled={locked || !canEdit}
            onChange={(e) => set('source_id', e.target.value)}
            required={!form.study_id}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          >
            <option value="">Chọn nguồn</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Câu hỏi nghiên cứu
          <select
            className="kpi-input"
            value={form.question_id}
            disabled={locked || !canEdit}
            onChange={(e) => set('question_id', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          >
            <option value="">—</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                Q{q.sort_order}: {q.question_vi}
              </option>
            ))}
          </select>
        </label>
        <label>
          Locator *
          <input
            className="kpi-input"
            value={form.locator}
            disabled={locked || !canEdit}
            onChange={(e) => set('locator', e.target.value)}
            required
            placeholder="T-12:03 hoặc URL#t=12"
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Excerpt
          <textarea
            className="kpi-input"
            rows={3}
            value={form.excerpt}
            disabled={locked || !canEdit}
            onChange={(e) => set('excerpt', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label>
            Value
            <input
              className="kpi-input"
              value={form.value_num}
              disabled={locked || !canEdit}
              onChange={(e) => set('value_num', e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Unit
            <input
              className="kpi-input"
              value={form.unit}
              disabled={locked || !canEdit}
              onChange={(e) => set('unit', e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Base
            <input
              className="kpi-input"
              value={form.value_base}
              disabled={locked || !canEdit}
              onChange={(e) => set('value_base', e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Period
            <input
              className="kpi-input"
              value={form.period_note}
              disabled={locked || !canEdit}
              onChange={(e) => set('period_note', e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
        </div>
        <label>
          Geography
          <input
            className="kpi-input"
            value={form.geography}
            disabled={locked || !canEdit}
            onChange={(e) => set('geography', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          PII class
          <select
            className="kpi-input"
            value={form.pii_class}
            disabled={locked || !canEdit}
            onChange={(e) => set('pii_class', e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          >
            <option value="">none</option>
            <option value="internal">internal</option>
            <option value="pii_masked">pii_masked</option>
            <option value="pii_restricted">pii_restricted</option>
          </select>
        </label>
        {canEdit ? (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {!locked ? (
              <button type="submit" className="btn btn-sm" disabled={saving || !form.locator.trim()}>
                {mode === 'supersede' ? 'Thay thế' : 'Lưu nháp'}
              </button>
            ) : null}
            {mode === 'edit' && evidence && evidence.qc_status === 'pending' && onVerify ? (
              <button
                type="button"
                className="btn btn-sm"
                disabled={saving}
                onClick={() => void onVerify(evidence)}
              >
                Verify
              </button>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
