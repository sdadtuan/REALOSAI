'use client';

import type { IntakeValidationIssue } from '@/lib/crm/intake-validation';

interface Props {
  issues: IntakeValidationIssue[];
}

export function IntakeValidationErrors({ issues }: Props) {
  if (issues.length === 0) return null;

  return (
    <div className="intake-validation-errors" role="alert">
      <strong>Không thể hoàn thành phiên:</strong>
      <ul>
        {issues.map((issue) => (
          <li key={issue.code}>{issue.message}</li>
        ))}
      </ul>
    </div>
  );
}
