import type { ReactNode } from 'react';
import Link from 'next/link';

type PortalPublicShellProps = {
  badge?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  narrow?: boolean;
};

export function PortalPublicShell({
  badge,
  title,
  subtitle,
  children,
  footer,
  narrow = false,
}: PortalPublicShellProps) {
  return (
    <main className="portal-public-shell">
      <header className="portal-public-shell__header">
        <div className="portal-public-shell__brand">
          <span className="portal-sidebar-brand-mark">PTT</span>
          <div>
            <strong>PTT Client Portal</strong>
            <span className="muted">Khách hàng doanh nghiệp</span>
          </div>
        </div>
        <Link href="/login" className="portal-public-shell__login-link">
          Đăng nhập
        </Link>
      </header>

      <div
        className={[
          'portal-public-shell__inner',
          narrow ? 'portal-public-shell__inner--narrow' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {badge ? <p className="badge portal-public-shell__badge">{badge}</p> : null}
        <h1 className="portal-public-shell__title">{title}</h1>
        {subtitle ? <p className="muted portal-public-shell__subtitle">{subtitle}</p> : null}
        <div className="portal-public-shell__content">{children}</div>
        {footer ? <footer className="portal-public-shell__footer muted">{footer}</footer> : null}
      </div>
    </main>
  );
}
