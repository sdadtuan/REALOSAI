'use client';

import { BANT_BADGE_LABELS, suggestBantBadge } from '@/lib/crm/intake-bant';
import { countDiscoveryChecked } from '@/lib/crm/intake-discovery';
import { INTAKE_DECISION_OPTIONS } from '@/lib/crm/intake-labels';
import type { IntakeValidationIssue } from '@/lib/crm/intake-validation';

interface Props {
  open: boolean;
  busy?: boolean;
  sessionLabel: string;
  bantTotal: number;
  decision: string;
  discoveryChecked: Record<string, boolean>;
  discoveryTotal: number;
  warnings: IntakeValidationIssue[];
  onCancel: () => void;
  onConfirm: () => void;
}

function decisionLabel(value: string): string {
  const found = INTAKE_DECISION_OPTIONS.find((option) => option.value === value)?.label;
  return found ?? (value || '—');
}

export function IntakeCompleteConfirmModal({
  open,
  busy,
  sessionLabel,
  bantTotal,
  decision,
  discoveryChecked,
  discoveryTotal,
  warnings,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  const badge = BANT_BADGE_LABELS[suggestBantBadge(bantTotal)];
  const checkedCount = countDiscoveryChecked(discoveryChecked);

  return (
    <div className="ai-dismiss-modal" role="presentation" onClick={onCancel}>
      <div
        className="ai-dismiss-modal__panel intake-complete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intake-complete-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 id="intake-complete-modal-title">Hoàn thành {sessionLabel}?</h4>

        <ul className="intake-complete-modal__summary">
          <li>
            BANT: {bantTotal}/30 · Gợi ý: {badge}
          </li>
          <li>Quyết định: {decisionLabel(decision)}</li>
          <li>
            Checklist: {checkedCount}/{discoveryTotal || '—'} câu đã tick
          </li>
        </ul>

        {warnings.length > 0 ? (
          <ul className="intake-complete-modal__warnings">
            {warnings.map((issue) => (
              <li key={issue.code}>⚠ {issue.message}</li>
            ))}
          </ul>
        ) : null}

        <div className="ai-dismiss-modal__actions">
          <button type="button" className="btn btn-sm btn-secondary" onClick={onCancel} disabled={busy}>
            Quay lại
          </button>
          <button type="button" className="btn btn-sm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Vẫn hoàn thành'}
          </button>
        </div>
      </div>
    </div>
  );
}
