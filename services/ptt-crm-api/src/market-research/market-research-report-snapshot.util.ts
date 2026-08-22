import type { MethodologyBlock, ReportExec } from './market-research.types';
import { normalizeReportExec } from './report-exec.util';

export type { MethodologyBlock };

export const CB_METHODOLOGY_STUB: MethodologyBlock = {
  stub: true,
  population: '',
  source_plan: '',
  limitation: '',
};

export type ReportCover = {
  client: string;
  title: string;
  confidential: boolean;
  version: number;
  as_of: string;
};

export type ReportFinding = {
  insight_id: number;
  question_id: number | null;
  heading: string;
  statement: string;
  text?: string;
  published_valid_to?: string | null;
};

export type ReportRec = {
  insight_id: number;
  recommendation: string;
  text?: string;
  published_valid_to?: string | null;
};

export type ReportEvidenceIndexRow = {
  ev_id: number;
  locator: string;
  insight_id: number;
};

export type ResearchReportSnapshot = {
  cover: ReportCover;
  exec: ReportExec;
  findings: ReportFinding[];
  recs: ReportRec[];
  methodology: MethodologyBlock;
  evidence_index: ReportEvidenceIndexRow[];
  status: string;
  insight_ids: number[];
};

export type ReportSnapshotInsight = {
  id: number;
  statement: string;
  recommendation?: string | null;
  observation?: string | null;
  evidence_ids: number[];
};

export type ReportSnapshotQuestion = {
  id: number;
  question_vi: string;
  sort_order: number;
};

export type ReportSnapshotEvidence = {
  id: number;
  locator: string;
  question_id?: number | null;
};

export type ReportSnapshotProject = {
  client_id: string;
  client_name?: string | null;
  title: string;
  decision_statement?: string | null;
};

export type LlmReportDraft = {
  cover?: { client?: unknown; title?: unknown };
  exec?: unknown;
  findings?: unknown;
  recs?: unknown;
};

function selectedSet(ids: number[]): Set<number> {
  return new Set(ids.filter((id) => Number.isFinite(id) && id > 0));
}

function insightQuestionId(
  insight: ReportSnapshotInsight,
  evidence: ReportSnapshotEvidence[],
): number | null {
  for (const evId of insight.evidence_ids) {
    const ev = evidence.find((row) => row.id === evId);
    if (ev?.question_id != null) return ev.question_id;
  }
  return null;
}

function questionHeading(
  questionId: number | null,
  questions: ReportSnapshotQuestion[],
): string {
  if (questionId == null) return 'Findings';
  const q = questions.find((row) => row.id === questionId);
  if (!q) return `RQ ${questionId}`;
  return `RQ${q.sort_order}: ${q.question_vi}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function filterDraftRows(raw: unknown, selected: Set<number>): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  const out: Record<string, unknown>[] = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const insightId = Number(rec.insight_id);
    if (!selected.has(insightId)) continue;
    out.push(rec);
  }
  return out;
}

export function buildReportSnapshot(input: {
  project: ReportSnapshotProject;
  insights: ReportSnapshotInsight[];
  questions: ReportSnapshotQuestion[];
  evidence: ReportSnapshotEvidence[];
  selectedInsightIds: number[];
  version: number;
  llmDraft?: LlmReportDraft | Record<string, unknown> | null;
  asOf?: string;
  methodology?: MethodologyBlock;
}): ResearchReportSnapshot {
  const selected = selectedSet(input.selectedInsightIds);
  const chosen = input.insights.filter((row) => selected.has(row.id));
  const evidenceIndex: ReportEvidenceIndexRow[] = [];
  for (const insight of chosen) {
    for (const evId of insight.evidence_ids) {
      const ev = input.evidence.find((row) => row.id === evId);
      if (ev) {
        evidenceIndex.push({ ev_id: ev.id, locator: ev.locator, insight_id: insight.id });
      }
    }
  }

  const draft = input.llmDraft ?? {};
  const draftFindings = filterDraftRows(draft.findings, selected);
  const draftRecs = filterDraftRows(draft.recs, selected);

  const findings: ReportFinding[] =
    draftFindings.length > 0
      ? draftFindings.map((row) => {
          const insightId = Number(row.insight_id);
          const insight = chosen.find((item) => item.id === insightId);
          const questionId = insight ? insightQuestionId(insight, input.evidence) : null;
          return {
            insight_id: insightId,
            question_id: questionId,
            heading: questionHeading(questionId, input.questions),
            statement: String(row.statement ?? row.text ?? insight?.statement ?? ''),
            text: row.text != null ? String(row.text) : undefined,
          };
        })
      : chosen.map((insight) => {
          const questionId = insightQuestionId(insight, input.evidence);
          return {
            insight_id: insight.id,
            question_id: questionId,
            heading: questionHeading(questionId, input.questions),
            statement: insight.statement,
          };
        });

  const recs: ReportRec[] =
    draftRecs.length > 0
      ? draftRecs.map((row) => ({
          insight_id: Number(row.insight_id),
          recommendation: String(
            row.recommendation ??
              row.text ??
              chosen.find((item) => item.id === Number(row.insight_id))?.recommendation ??
              '',
          ),
          text: row.text != null ? String(row.text) : undefined,
        }))
      : chosen
          .filter((insight) => Boolean(insight.recommendation?.trim()))
          .map((insight) => ({
            insight_id: insight.id,
            recommendation: String(insight.recommendation),
          }));

  const draftRec = asRecord(draft) ?? {};
  let rawExec: unknown = draftRec.exec;
  if (typeof rawExec === 'string' && draftRec.en != null) {
    rawExec = { vi: rawExec, en: draftRec.en };
  }
  if (rawExec == null || (typeof rawExec === 'string' && !rawExec.trim())) {
    rawExec = input.project.decision_statement ?? '';
  }
  const exec = normalizeReportExec(rawExec);
  if (exec.en_status === 'approved') {
    exec.en_status = exec.en ? 'draft' : 'none';
  }

  return {
    cover: {
      client: input.project.client_name?.trim() || input.project.client_id,
      title: input.project.title,
      confidential: true,
      version: input.version,
      as_of: input.asOf ?? new Date().toISOString().slice(0, 10),
    },
    exec,
    findings,
    recs,
    methodology: input.methodology ?? CB_METHODOLOGY_STUB,
    evidence_index: evidenceIndex,
    status: 'draft',
    insight_ids: chosen.map((row) => row.id),
  };
}
