'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  CONSENT_TYPE_LABELS,
  CONSENT_TYPES,
  createResearchConsent,
  createResearchStudy,
  fetchResearchConsents,
  fetchResearchStudies,
  ingestResearchWhisper,
  importResearchSurvey,
  STUDY_METHOD_LABELS,
  STUDY_METHODS,
  STUDY_MODE_LABELS,
  STUDY_MODES,
  TRANSITION_REASON_VI,
  ResearchApiError,
  type ConsentType,
  type ResearchAiRun,
  type ResearchConsent,
  type ResearchStudy,
  type StudyMethod,
  type StudyMode,
} from '@/lib/market-research-api';
import { ResearchJobChip } from '@/components/research/ResearchJobChip';
import {
  UPLOAD_DISABLED_TITLE,
  WHISPER_AUDIO_MIMES,
  WHISPER_PRIVACY_BANNER,
  isWhisperAudioMime,
  studyHasUnexpiredConsent,
} from '@/components/research/studies-whisper.util';
import {
  CODEBOOK_CSV_ACCEPT,
  CODEBOOK_IMPORT_BANNER,
  CODEBOOK_IMPORT_DISABLED_TITLE,
  DEFAULT_VW_UNIT,
  EXPERT_REVIEW_PLACEHOLDER,
  SURVEY_IMPORT_FORMATS,
  type SurveyImportFormat,
  isCodebookCsvFile,
  isVwGeographyMissing,
  surveyStudiesForImport,
  surveyImportFormatsForProduct,
} from '@/components/research/studies-codebook.util';

const emptyStudy = {
  name: '',
  method: 'idi' as StudyMethod,
  n: '',
  field_start: '',
  field_end: '',
  mode: '' as '' | StudyMode,
};

export function StudiesPane({
  projectId,
  productType,
  canEdit,
  canRun,
  onIngested,
}: {
  projectId: number;
  productType?: string;
  canEdit: boolean;
  canRun: boolean;
  onIngested?: () => void;
}) {
  const [studies, setStudies] = useState<ResearchStudy[]>([]);
  const [consents, setConsents] = useState<ResearchConsent[]>([]);
  const [consentsByStudy, setConsentsByStudy] = useState<Record<number, ResearchConsent[]>>({});
  const [filesByStudy, setFilesByStudy] = useState<Record<number, File | undefined>>({});
  const [error, setError] = useState('');
  const [ingestNote, setIngestNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingStudyId, setUploadingStudyId] = useState<number | null>(null);
  const [whisperRunId, setWhisperRunId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyStudy);
  const [consentStudyId, setConsentStudyId] = useState<number | null>(null);
  const [subjectCode, setSubjectCode] = useState('');
  const [consentType, setConsentType] = useState<ConsentType>('record');
  const [importFile, setImportFile] = useState<File | undefined>();
  const [importFormat, setImportFormat] = useState<SurveyImportFormat>('codebook');
  const [importStudyId, setImportStudyId] = useState('');
  const [periodNote, setPeriodNote] = useState('');
  const [geography, setGeography] = useState('');
  const [unit, setUnit] = useState(DEFAULT_VW_UNIT);
  const [expertReview, setExpertReview] = useState('');
  const [importing, setImporting] = useState(false);

  const importFormats = surveyImportFormatsForProduct(productType ?? '');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const out = await fetchResearchStudies(token, projectId);
    setStudies(out.studies);
    const entries = await Promise.all(
      out.studies.map(async (row) => {
        try {
          const listed = await fetchResearchConsents(token, row.id);
          return [row.id, listed.consents] as const;
        } catch {
          return [row.id, []] as const;
        }
      }),
    );
    setConsentsByStudy(Object.fromEntries(entries));
  }, [projectId]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : 'Tải study thất bại');
    });
  }, [load]);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createResearchStudy(token, projectId, {
        name: form.name.trim(),
        method: form.method,
        n: form.n.trim() === '' ? null : Number(form.n),
        field_start: form.field_start || null,
        field_end: form.field_end || null,
        mode: form.mode || null,
      });
      setForm(emptyStudy);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm study thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function openConsent(studyId: number) {
    const token = getAccessToken();
    if (!token) return;
    setConsentStudyId(studyId);
    setSubjectCode('');
    setConsentType('record');
    setError('');
    try {
      const out = await fetchResearchConsents(token, studyId);
      setConsents(out.consents);
      setConsentsByStudy((prev) => ({ ...prev, [studyId]: out.consents }));
    } catch (err) {
      setConsents([]);
      setConsentsByStudy((prev) => ({ ...prev, [studyId]: [] }));
      setError(err instanceof Error ? err.message : 'Tải consent thất bại');
    }
  }

  async function onConsent(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || consentStudyId == null || !subjectCode.trim()) return;
    setSaving(true);
    setError('');
    try {
      await createResearchConsent(token, consentStudyId, {
        subject_code: subjectCode.trim(),
        consent_type: consentType,
      });
      setSubjectCode('');
      const out = await fetchResearchConsents(token, consentStudyId);
      setConsents(out.consents);
      setConsentsByStudy((prev) => ({ ...prev, [consentStudyId]: out.consents }));
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code === 'consent_pii_forbidden') {
        setError('Consent không được chứa SĐT hoặc email.');
      } else {
        setError(err instanceof Error ? err.message : 'Ghi consent thất bại');
      }
    } finally {
      setSaving(false);
    }
  }

  function onPickAudio(studyId: number, file: File | undefined) {
    setError('');
    setIngestNote('');
    if (!file) {
      setFilesByStudy((prev) => ({ ...prev, [studyId]: undefined }));
      return;
    }
    if (!isWhisperAudioMime(file.type)) {
      setError('Chỉ nhận audio/mpeg, audio/wav, audio/mp4, audio/x-m4a.');
      setFilesByStudy((prev) => ({ ...prev, [studyId]: undefined }));
      return;
    }
    setFilesByStudy((prev) => ({ ...prev, [studyId]: file }));
  }

  async function onUploadAudio(studyId: number) {
    const token = getAccessToken();
    const file = filesByStudy[studyId];
    const ingestible = studyHasUnexpiredConsent(consentsByStudy[studyId] ?? []);
    if (!token || !canRun || !ingestible) return;
    if (!file || !isWhisperAudioMime(file.type)) {
      setError('Chỉ nhận audio/mpeg, audio/wav, audio/mp4, audio/x-m4a.');
      return;
    }
    setUploadingStudyId(studyId);
    setError('');
    setIngestNote('');
    setWhisperRunId(null);
    try {
      const out = await ingestResearchWhisper(token, projectId, studyId, file);
      setWhisperRunId(out.run_id);
      if ((out.excerpt_ids ?? []).length > 0) {
        setIngestNote('Đã tạo excerpt — mở tab Evidence');
        onIngested?.();
      } else if (out.status === 'failed') {
        setError(
          TRANSITION_REASON_VI[out.note ?? ''] ?? out.note ?? 'Tải audio thất bại',
        );
      }
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      setError(
        (api?.code ? TRANSITION_REASON_VI[api.code] : undefined) ??
          (err instanceof Error ? err.message : 'Tải audio thất bại'),
      );
      setWhisperRunId(null);
    } finally {
      setUploadingStudyId(null);
    }
  }

  function onWhisperSettled(run: ResearchAiRun) {
    if (run.status === 'succeeded') {
      setIngestNote('Đã tạo excerpt — mở tab Evidence');
      onIngested?.();
      return;
    }
    setError(
      TRANSITION_REASON_VI[run.error_message ?? ''] ??
        run.error_message ??
        'Tải audio thất bại',
    );
  }

  function onPickCodebook(file: File | undefined) {
    setError('');
    setIngestNote('');
    if (!file) {
      setImportFile(undefined);
      return;
    }
    if (!isCodebookCsvFile(file)) {
      setError('Chỉ nhận file CSV.');
      setImportFile(undefined);
      return;
    }
    setImportFile(file);
  }

  async function onImportCodebook(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !canEdit) return;
    if (!importFile || !isCodebookCsvFile(importFile)) {
      setError('Chỉ nhận file CSV.');
      return;
    }
    if (isVwGeographyMissing(importFormat, geography)) {
      setError('Geography bắt buộc với format VW.');
      return;
    }
    setImporting(true);
    setError('');
    setIngestNote('');
    try {
      const form = new FormData();
      form.append('file', importFile);
      form.append('format', importFormat);
      if (importStudyId.trim()) form.append('study_id', importStudyId.trim());
      if (expertReview.trim()) form.append('expert_review', expertReview.trim());
      if (periodNote.trim()) form.append('period_note', periodNote.trim());
      if (geography.trim()) form.append('geography', geography.trim());
      if (importFormat === 'vw') form.append('unit', unit.trim() || DEFAULT_VW_UNIT);
      const out = await importResearchSurvey(token, projectId, form);
      setIngestNote(`Đã nhập ${out.n} evidence — mở tab Evidence`);
      setImportFile(undefined);
      setExpertReview('');
      await load();
      onIngested?.();
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      setError(
        (api?.code ? TRANSITION_REASON_VI[api.code] : undefined) ??
          (err instanceof Error ? err.message : 'Nhập codebook thất bại'),
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="card" style={{ padding: '0.9rem' }}>
      <div className="stack-gap">
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Studies</h2>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Study IDI/FGD/survey. Consent dùng mã giả danh (ví dụ R-004) — không nhập SĐT.
        </p>
        <p className="muted" role="note" style={{ margin: 0, fontSize: '0.85rem' }}>
          {WHISPER_PRIVACY_BANNER}
        </p>
        <p className="muted" role="note" style={{ margin: 0, fontSize: '0.85rem' }}>
          {CODEBOOK_IMPORT_BANNER}
        </p>
        {error ? <p className="error" style={{ margin: 0 }}>{error}</p> : null}
        {ingestNote ? <p className="muted" style={{ margin: 0 }}>{ingestNote}</p> : null}
        {whisperRunId != null ? (
          <ResearchJobChip
            token={getAccessToken()}
            projectId={projectId}
            runId={whisperRunId}
            kind="whisper"
            onSettled={onWhisperSettled}
          />
        ) : null}
        {canEdit ? (
          <form onSubmit={(e) => void onAdd(e)} style={{ display: 'grid', gap: '0.5rem' }}>
            <label>
              Tên study *
              <input
                className="kpi-input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              Method *
              <select
                className="kpi-input"
                value={form.method}
                onChange={(e) => setForm((p) => ({ ...p, method: e.target.value as StudyMethod }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                {STUDY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {STUDY_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              n
              <input
                className="kpi-input"
                type="number"
                min={1}
                value={form.n}
                onChange={(e) => setForm((p) => ({ ...p, n: e.target.value }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <label>
                Field start
                <input
                  className="kpi-input"
                  type="date"
                  value={form.field_start}
                  onChange={(e) => setForm((p) => ({ ...p, field_start: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
              <label>
                Field end
                <input
                  className="kpi-input"
                  type="date"
                  value={form.field_end}
                  onChange={(e) => setForm((p) => ({ ...p, field_end: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: 4 }}
                />
              </label>
            </div>
            <label>
              Mode
              <select
                className="kpi-input"
                value={form.mode}
                onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value as StudyMode | '' }))}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                <option value="">—</option>
                {STUDY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {STUDY_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-sm" disabled={saving}>
              + Thêm study
            </button>
          </form>
        ) : null}
        <form
          onSubmit={(e) => void onImportCodebook(e)}
          style={{ display: 'grid', gap: '0.5rem' }}
        >
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Nhập codebook</h3>
          <label>
            Format *
            <select
              className="kpi-input"
              value={importFormat}
              disabled={!canEdit}
              onChange={(e) => setImportFormat(e.target.value as SurveyImportFormat)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            >
              {importFormats.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {fmt}
                </option>
              ))}
            </select>
          </label>
          <label>
            Study (survey)
            <select
              className="kpi-input"
              value={importStudyId}
              disabled={!canEdit}
              onChange={(e) => setImportStudyId(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            >
              <option value="">Tạo study mới</option>
              {surveyStudiesForImport(studies).map((row) => (
                <option key={row.id} value={String(row.id)}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            File CSV *
            <input
              type="file"
              accept={CODEBOOK_CSV_ACCEPT}
              aria-label="Chọn CSV codebook"
              disabled={!canEdit}
              onChange={(e) => onPickCodebook(e.target.files?.[0])}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Period note
            <input
              className="kpi-input"
              value={periodNote}
              disabled={!canEdit}
              onChange={(e) => setPeriodNote(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Geography{importFormat === 'vw' ? ' *' : ''}
            <input
              className="kpi-input"
              value={geography}
              disabled={!canEdit}
              required={importFormat === 'vw'}
              onChange={(e) => setGeography(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          {importFormat === 'vw' ? (
            <label>
              Unit
              <input
                className="kpi-input"
                value={unit}
                disabled={!canEdit}
                onChange={(e) => setUnit(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
          ) : null}
          <label>
            ExpertReview
            <textarea
              className="kpi-input"
              value={expertReview}
              disabled={!canEdit}
              placeholder={EXPERT_REVIEW_PLACEHOLDER}
              onChange={(e) => setExpertReview(e.target.value)}
              rows={3}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <button
            type="submit"
            className="btn btn-sm"
            disabled={!canEdit || importing || !importFile}
            title={!canEdit ? CODEBOOK_IMPORT_DISABLED_TITLE : undefined}
          >
            Nhập codebook
          </button>
        </form>
        {studies.length === 0 ? (
          <p className="muted">Chưa có study.</p>
        ) : (
          studies.map((row) => (
            <article key={row.id} className="card" style={{ padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong>{row.name}</strong>
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  {STUDY_METHOD_LABELS[row.method]}
                  {row.n != null ? ` · n=${row.n}` : ''}
                  {row.mode ? ` · ${STUDY_MODE_LABELS[row.mode]}` : ''}
                </span>
              </div>
              {(row.field_start || row.field_end) ? (
                <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
                  Field: {row.field_start ?? '—'} → {row.field_end ?? '—'}
                </p>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: 8 }}>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => void openConsent(row.id)}
                  >
                    Consent
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => void openConsent(row.id)}
                  >
                    Xem consent
                  </button>
                )}
                <input
                  type="file"
                  accept={WHISPER_AUDIO_MIMES.join(',')}
                  aria-label={`Chọn audio study ${row.name}`}
                  disabled={!canRun || !studyHasUnexpiredConsent(consentsByStudy[row.id] ?? [])}
                  onChange={(e) => onPickAudio(row.id, e.target.files?.[0])}
                  style={{ maxWidth: '14rem' }}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={
                    !canRun ||
                    !studyHasUnexpiredConsent(consentsByStudy[row.id] ?? []) ||
                    uploadingStudyId === row.id ||
                    !filesByStudy[row.id]
                  }
                  title={
                    !canRun || !studyHasUnexpiredConsent(consentsByStudy[row.id] ?? [])
                      ? UPLOAD_DISABLED_TITLE
                      : undefined
                  }
                  onClick={() => void onUploadAudio(row.id)}
                >
                  Tải audio
                </button>
              </div>
            </article>
          ))
        )}
      </div>
      {consentStudyId != null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Consent"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 28, 20, 0.35)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 40,
          }}
          onClick={() => setConsentStudyId(null)}
        >
          <form
            className="card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void onConsent(e)}
            style={{
              width: 'min(420px, 100%)',
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
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Consent</h2>
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setConsentStudyId(null)}>
                Đóng
              </button>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Mã giả danh (R-004). Không nhập số điện thoại.
            </p>
            {canEdit ? (
              <>
                <label>
                  Subject code *
                  <input
                    className="kpi-input"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    required
                    placeholder="R-004"
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  />
                </label>
                <label>
                  Loại consent *
                  <select
                    className="kpi-input"
                    value={consentType}
                    onChange={(e) => setConsentType(e.target.value as ConsentType)}
                    style={{ display: 'block', width: '100%', marginTop: 4 }}
                  >
                    {CONSENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CONSENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn btn-sm" disabled={saving || !subjectCode.trim()}>
                  Ghi consent
                </button>
              </>
            ) : null}
            {consents.length === 0 ? (
              <p className="muted">Chưa có consent.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {consents.map((c) => (
                  <li key={c.id} style={{ marginBottom: '0.4rem' }}>
                    <strong>{c.subject_code}</strong>{' '}
                    <span className="muted">{CONSENT_TYPE_LABELS[c.consent_type]}</span>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      Hết hạn {c.expires_at}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </form>
        </div>
      ) : null}
    </section>
  );
}
