import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  importResearchSurvey,
  insightConfidencePayload,
  ingestResearchWhisper,
  normalizeReportExec,
  type ConfidenceRubric,
} from './market-research-api';

const empty: ConfidenceRubric = { S: 0, F: 0, T: 0, A: 0, R: 0 };

describe('normalizeReportExec', () => {
  it("normalizeReportExec('hello') → { vi: 'hello', en: null, en_status: 'none' }", () => {
    expect(normalizeReportExec('hello')).toEqual({
      vi: 'hello',
      en: null,
      en_status: 'none',
    });
  });
});

describe('insightConfidencePayload', () => {
  it('omits all-zero fallback when untouched and no stored rubric', () => {
    expect(insightConfidencePayload(empty, { touched: false, hasStoredRubric: false })).toBeUndefined();
  });

  it('sends rubric when the analyst touched it', () => {
    expect(insightConfidencePayload(empty, { touched: true, hasStoredRubric: false })).toEqual(empty);
  });

  it('sends rubric when a stored rubric exists', () => {
    const stored: ConfidenceRubric = { S: 2, F: 2, T: 1, A: 3, R: 2 };
    expect(insightConfidencePayload(stored, { touched: false, hasStoredRubric: true })).toEqual(stored);
  });
});

describe('ingestResearchWhisper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs multipart FormData file without JSON-encoding', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, run_id: 9, study_id: 2, excerpt_ids: [] }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File([new Uint8Array([1, 2, 3])], 'idi.mp3', { type: 'audio/mpeg' });

    const out = await ingestResearchWhisper('tok', 1, 2, file);

    expect(out).toEqual({ ok: true, run_id: 9, study_id: 2, excerpt_ids: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/research\/projects\/1\/studies\/2\/whisper$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('file')).toBe(file);
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(headers.get('Content-Type')).toBeNull();
  });
});

describe('importResearchSurvey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs multipart FormData without JSON-encoding the file', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ ok: true, study_id: 5, source_id: 20, evidence_ids: [101, 102], n: 2 }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['respondent_id,question_code\nR001,Q1'], 'codebook.csv', {
      type: 'text/csv',
    });
    const form = new FormData();
    form.append('file', file);
    form.append('format', 'codebook');
    form.append('expert_review', 'Forms convenience');

    const out = await importResearchSurvey('tok', 9, form);

    expect(out).toEqual({
      ok: true,
      study_id: 5,
      source_id: 20,
      evidence_ids: [101, 102],
      n: 2,
    });
    expect(out).not.toHaveProperty('insight_id');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/research\/projects\/9\/import-survey$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(form);
    expect(init.body).toBeInstanceOf(FormData);
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(headers.get('Content-Type')).toBeNull();
  });
});
