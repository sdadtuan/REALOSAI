'use client';

import Link from 'next/link';
import type { FunnelPrimaryAction, FunnelStepperContext } from '@/lib/crm/funnel-stepper.types';

interface Props {
  action: FunnelPrimaryAction | null;
  secondaryAction?: FunnelPrimaryAction | null;
  context: FunnelStepperContext;
  busy?: boolean;
  onAction?: (action: FunnelPrimaryAction) => void | Promise<void>;
}

function confirmMessage(action: FunnelPrimaryAction): string {
  return action.blockReason || 'Xác nhận chuyển giai đoạn?';
}

export function CrmFunnelStepPrimaryAction({
  action,
  secondaryAction,
  context,
  busy,
  onAction,
}: Props) {
  const sticky = context === 'intake';
  const barClass = `crm-funnel-stepper__cta-bar${sticky ? ' crm-funnel-stepper__cta-bar--sticky' : ''}`;

  function renderButton(target: FunnelPrimaryAction, variant: 'primary' | 'secondary') {
    if (target.kind === 'none') {
      if (!target.label) return null;
      return (
        <button type="button" className="btn btn-sm" disabled title={target.blockReason}>
          {target.label}
        </button>
      );
    }

    if (target.kind === 'link' && target.href) {
      return (
        <Link href={target.href} className={`btn btn-sm ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`}>
          {target.label}
        </Link>
      );
    }

    if (target.kind === 'anchor' && target.anchor) {
      return (
        <a href={target.anchor} className={`btn btn-sm ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`}>
          {target.label}
        </a>
      );
    }

    const btnClass =
      variant === 'primary'
        ? target.kind === 'advance_presales' ||
            target.kind === 'handoff_solution' ||
            target.kind === 'claim_solution' ||
            target.kind === 'release_to_sales' ||
            target.kind === 'ensure_presales'
          ? 'btn-primary'
          : 'btn'
        : 'btn-secondary';

    const runAction = () => {
      if (!onAction || target.disabled || busy) return;
      if (target.requiresConfirm && !window.confirm(confirmMessage(target))) return;
      void onAction(target);
    };

    return (
      <button
        type="button"
        className={`btn btn-sm ${btnClass}`}
        disabled={target.disabled || busy}
        title={target.disabled ? target.blockReason : undefined}
        onClick={runAction}
      >
        {busy && variant === 'primary' ? 'Đang xử lý…' : target.label}
      </button>
    );
  }

  if ((!action || (action.kind === 'none' && !action.label)) && !secondaryAction) {
    return null;
  }

  if (!action || action.kind === 'none') {
    if (!action?.label && secondaryAction) {
      return (
        <div className={barClass}>
          {renderButton(secondaryAction, 'secondary')}
        </div>
      );
    }
    if (!action?.label) return null;
    return (
      <div className={barClass}>
        <button type="button" className="btn btn-sm" disabled title={action.blockReason}>
          {action.label}
        </button>
        {action.blockReason ? (
          <p className="muted crm-funnel-stepper__cta-hint">{action.blockReason}</p>
        ) : null}
      </div>
    );
  }

  const stickyBar = barClass;

  if (action.kind === 'link' && action.href && !secondaryAction) {
    return (
      <div className={stickyBar}>
        <Link href={action.href} className="btn btn-primary btn-sm">
          {action.label}
        </Link>
      </div>
    );
  }

  if (action.kind === 'anchor' && action.anchor && !secondaryAction) {
    return (
      <div className={stickyBar}>
        <a href={action.anchor} className="btn btn-primary btn-sm">
          {action.label}
        </a>
      </div>
    );
  }

  return (
    <div className={stickyBar}>
      {renderButton(action, 'primary')}
      {secondaryAction ? renderButton(secondaryAction, 'secondary') : null}
      {action.disabled && action.blockReason ? (
        <p className="muted crm-funnel-stepper__cta-hint">{action.blockReason}</p>
      ) : null}
      {action.requiresOverride && !action.disabled ? (
        <p className="muted crm-funnel-stepper__cta-hint">Cần quyền Director và lý do override.</p>
      ) : null}
    </div>
  );
}
