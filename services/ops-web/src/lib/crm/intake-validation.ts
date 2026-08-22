import { BANT_KEYS } from '@/lib/crm/intake-bant';
import {
  countCriticalAnswered,
  countDiscoveryChecked,
  type DiscoveryResponseEntry,
  type IntakeQuestionItem,
  type IntakeSessionMode,
} from '@/lib/crm/intake-discovery';
import { hasDecisionMakerName, type IntakeStakeholderRow } from '@/lib/crm/intake-stakeholders';
import { countRedFlagsChecked } from '@/lib/crm/intake-red-flags';

export type IntakeValidationLevel = 'error' | 'warn';

export interface IntakeValidationIssue {
  level: IntakeValidationLevel;
  code: string;
  message: string;
}

export interface IntakeCompleteValidationInput {
  contactName: string;
  need: string;
  bant: Record<string, number>;
  decision: string;
  decisionReason: string;
  sessionMode: IntakeSessionMode;
  discoveryChecked: Record<string, boolean>;
  discoveryResponses: Record<string, DiscoveryResponseEntry>;
  discoveryTotal: number;
  questionItems: IntakeQuestionItem[];
  redFlagsChecked: Record<string, boolean>;
  stakeholders: IntakeStakeholderRow[];
}

export function isRichTextEmpty(html: string): boolean {
  if (!html.trim()) return true;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !text;
}

export function validateIntakeComplete(input: IntakeCompleteValidationInput): IntakeValidationIssue[] {
  const issues: IntakeValidationIssue[] = [];
  const checkedCount = countDiscoveryChecked(input.discoveryChecked);
  const checklistMin = input.sessionMode === 'phone' ? 8 : 6;
  const redFlagCount = countRedFlagsChecked(input.redFlagsChecked);
  const critical = countCriticalAnswered(
    input.questionItems,
    input.discoveryChecked,
    input.discoveryResponses,
  );

  if (!input.contactName.trim()) {
    issues.push({
      level: 'error',
      code: 'contact_name',
      message: 'Liên hệ "Contact" không được để trống.',
    });
  }

  if (!input.decision) {
    issues.push({
      level: 'error',
      code: 'decision',
      message: 'Cần chọn Quyết định "Decision" trước khi hoàn thành.',
    });
  }

  if (
    (input.decision === 'nurture' || input.decision === 'no_go') &&
    !input.decisionReason.trim()
  ) {
    issues.push({
      level: 'error',
      code: 'decision_reason',
      message: 'Lý do "Reason" bắt buộc khi chọn Nurture hoặc No-Go.',
    });
  }

  const unscored = BANT_KEYS.filter((key) => {
    const score = Number(input.bant[key] ?? 0);
    return score < 1 || score > 5;
  });
  if (unscored.length > 0) {
    issues.push({
      level: 'warn',
      code: 'bant_unscored',
      message: `Còn ${unscored.length} tiêu chí BANT chưa chấm (1–5).`,
    });
  }

  if (input.discoveryTotal > 0 && checkedCount < checklistMin) {
    issues.push({
      level: 'warn',
      code: 'checklist_low',
      message: `Checklist mới ${checkedCount}/${input.discoveryTotal} câu — gợi ý ≥${checklistMin}.`,
    });
  }

  if (critical.total > 0 && critical.answered < critical.total) {
    issues.push({
      level: 'warn',
      code: 'critical_answers_missing',
      message: `Còn ${critical.total - critical.answered}/${critical.total} câu quan trọng chưa có câu trả lời.`,
    });
  }

  if (isRichTextEmpty(input.need)) {
    issues.push({
      level: 'warn',
      code: 'need_empty',
      message: 'Nhu cầu / điểm đau "Need / Pain" đang trống.',
    });
  }

  if (redFlagCount >= 2) {
    issues.push({
      level: 'warn',
      code: 'red_flags_high',
      message: `Đã tick ${redFlagCount} red flag — gợi ý No-Go hoặc Nurture; ghi rõ lý do.`,
    });
  }

  if (input.decision === 'go' && redFlagCount >= 2) {
    issues.push({
      level: 'warn',
      code: 'go_with_red_flags',
      message: 'Quyết định Go nhưng có ≥2 red flag — cần lý do override rõ ràng.',
    });
  }

  if (input.decision === 'go' && !hasDecisionMakerName(input.stakeholders)) {
    issues.push({
      level: 'warn',
      code: 'stakeholder_dm_missing',
      message: 'Go nhưng chưa ghi tên Decision Maker trong ma trận stakeholder.',
    });
  }

  return issues;
}

export function intakeValidationErrors(issues: IntakeValidationIssue[]): IntakeValidationIssue[] {
  return issues.filter((issue) => issue.level === 'error');
}

export function intakeValidationWarnings(issues: IntakeValidationIssue[]): IntakeValidationIssue[] {
  return issues.filter((issue) => issue.level === 'warn');
}
