import type { ReactNode } from 'react';

type WinEmptyStateProps = {
  icon?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export function WinEmptyState({ icon = '📋', title, subtitle, children }: WinEmptyStateProps) {
  return (
    <div className="win-empty-state" role="status">
      <span className="win-empty-state__icon" aria-hidden="true">
        {icon}
      </span>
      <h3 className="win-empty-state__title">{title}</h3>
      {subtitle ? <p className="win-empty-state__subtitle">{subtitle}</p> : null}
      {children ? <div className="win-empty-state__actions">{children}</div> : null}
    </div>
  );
}
