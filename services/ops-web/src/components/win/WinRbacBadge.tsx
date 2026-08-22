'use client';

import type { StoredStaffUser } from '@/lib/auth';

type WinRbacBadgeProps = {
  user?: StoredStaffUser | null;
  positionCode?: string | null;
  jobFunctions?: string[];
  className?: string;
  maxFunctions?: number;
};

function formatRbacLabel(
  positionCode: string | undefined,
  functions: string[],
  maxFunctions: number,
): string | null {
  const code = positionCode?.trim();
  const fnList = functions.map((f) => f.trim()).filter(Boolean);
  if (!code && fnList.length === 0) return null;

  const fnPart =
    fnList.length === 0
      ? null
      : fnList.length <= maxFunctions
        ? fnList.join(', ')
        : `${fnList.slice(0, maxFunctions).join(', ')} +${fnList.length - maxFunctions}`;

  if (code && fnPart) return `${code} · ${fnPart}`;
  if (code) return code;
  return fnPart;
}

export function WinRbacBadge({
  user = null,
  positionCode,
  jobFunctions,
  className = '',
  maxFunctions = 3,
}: WinRbacBadgeProps) {
  const code = positionCode ?? user?.position_code ?? undefined;
  const functions = jobFunctions ?? user?.job_functions ?? [];
  const label = formatRbacLabel(code, functions, maxFunctions);
  if (!label) return null;

  const overflow =
    functions.length > maxFunctions ? functions.slice(maxFunctions).join(', ') : undefined;

  return (
    <span
      className={`win-badge-rbac ${className}`.trim()}
      title={overflow ? `${label} (${overflow})` : label}
    >
      {label}
    </span>
  );
}
