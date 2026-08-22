import { describe, expect, it } from 'vitest';
import { qualtricsRunDisabled, qualtricsRunnableStudies } from './qualtrics-run.util';

describe('qualtrics-run.util', () => {
  it('qualtricsRunDisabled without study', () => {
    expect(qualtricsRunDisabled({ saving: false, studyId: null, inFlight: false })).toBe(true);
  });

  it('qualtricsRunnableStudies filters survey with SV_ instrument', () => {
    const out = qualtricsRunnableStudies([
      { id: 1, project_id: 9, name: 'A', method: 'survey', instrument_version: 'SV_abc', n: null, field_start: null, field_end: null, mode: null, weighting_note: null },
      { id: 2, project_id: 9, name: 'B', method: 'survey', instrument_version: 'v1', n: null, field_start: null, field_end: null, mode: null, weighting_note: null },
      { id: 3, project_id: 9, name: 'C', method: 'interview', instrument_version: 'SV_x', n: null, field_start: null, field_end: null, mode: null, weighting_note: null },
    ]);
    expect(out.map((s) => s.id)).toEqual([1]);
  });
});
