import type { ReactNode } from 'react';

type PortalAuthShellProps = {
  badge?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function PortalAuthShell({ badge, title, subtitle, children, footer }: PortalAuthShellProps) {
  return (
    <main className="portal-auth-shell">
      <div className="portal-auth-shell__brand">
        <span className="portal-sidebar-brand-mark">PTT</span>
        <div>
          <strong>PTT Client Portal</strong>
          <span className="muted">Xem hiệu quả & duyệt creative</span>
        </div>
      </div>
      <div className="card portal-auth-shell__card">
        {badge ? <p className="badge portal-auth-shell__badge">{badge}</p> : null}
        <h1 className="portal-auth-shell__title">{title}</h1>
        {subtitle ? <p className="muted portal-auth-shell__subtitle">{subtitle}</p> : null}
        {children}
        {footer ? <div className="portal-auth-shell__footer">{footer}</div> : null}
      </div>
    </main>
  );
}
