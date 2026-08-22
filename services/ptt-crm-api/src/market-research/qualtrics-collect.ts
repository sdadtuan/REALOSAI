import { fetchQualtricsExportCsv } from './qualtrics-client.util';
import type { CodebookEvidenceDraft, QualtricsColumnMapEntry } from './market-research.types';
import { parseCodebookCsv } from './survey-codebook.util';
import { wideCsvToCodebookCsv } from './qualtrics-to-codebook.util';

export async function collectQualtrics(input: {
  surveyId: string;
  apiKey: string;
  datacenter: string;
  columnMap: Record<string, QualtricsColumnMapEntry>;
}): Promise<{
  drafts: CodebookEvidenceDraft[];
  progress_id: string;
  file_id: string;
}> {
  const exported = await fetchQualtricsExportCsv({
    surveyId: input.surveyId,
    apiKey: input.apiKey,
    datacenter: input.datacenter,
  });
  const codebookCsv = wideCsvToCodebookCsv(exported.csvText, input.columnMap);
  const drafts = parseCodebookCsv(codebookCsv);
  return { drafts, progress_id: exported.progress_id, file_id: exported.file_id };
}
