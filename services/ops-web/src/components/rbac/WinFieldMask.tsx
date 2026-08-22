'use client';

import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { winFieldAbacEnabled } from '@/lib/win/flags';

type Variant = 'financial' | 'pii' | 'generic';

type Props = {
  user: StoredStaffUser | null;
  value: string | number | null | undefined;
  section?: string;
  action?: string;
  variant?: Variant;
  className?: string;
  title?: string;
};

const DEFAULT_ACTION: Record<Variant, { section: string; action: string }> = {
  financial: { section: 'crm_leads', action: 'view_financial' },
  pii: { section: 'crm_leads', action: 'view_pii' },
  generic: { section: 'crm_leads', action: 'view' },
};

export function WinFieldMask({
  user,
  value,
  section,
  action,
  variant = 'generic',
  className = '',
  title,
}: Props) {
  if (!winFieldAbacEnabled()) {
    const raw = value == null || value === '' ? '—' : String(value);
    return <span className={className}>{raw}</span>;
  }

  const defaults = DEFAULT_ACTION[variant];
  const sec = section ?? defaults.section;
  const act = action ?? defaults.action;
  const allowed = Boolean(user && hasCap(user, sec, act));
  const display = allowed
    ? value == null || value === ''
      ? '—'
      : String(value)
    : variant === 'financial'
      ? '••••'
      : '***';

  return (
    <span
      className={`win-field-mask${allowed ? '' : ' win-field-mask--masked'} ${className}`.trim()}
      title={title ?? (allowed ? undefined : `Cần quyền ${sec}.${act}`)}
    >
      {display}
    </span>
  );
}
