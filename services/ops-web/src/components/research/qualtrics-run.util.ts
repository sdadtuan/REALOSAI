import type { ResearchStudy } from '@/lib/market-research-api';

const SV_ID = /^SV_[A-Za-z0-9]+$/;

export function qualtricsRunnableStudies(studies: ResearchStudy[]): ResearchStudy[] {
  return studies.filter(
    (row) => row.method === 'survey' && SV_ID.test(String(row.instrument_version ?? '').trim()),
  );
}

export function qualtricsRunDisabled(input: {
  saving: boolean;
  studyId: number | null;
  inFlight: boolean;
}): boolean {
  return input.saving || input.studyId == null || input.inFlight;
}
