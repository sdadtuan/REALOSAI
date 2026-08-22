'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { PageToolbar } from './PageToolbar';

type DetailPageLayoutProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function DetailPageLayout({
  title,
  subtitle,
  backHref,
  backLabel = '← Quay lại',
  actions,
  children,
  aside,
  className,
}: DetailPageLayoutProps) {
  return (
    <>
      {backHref ? (
        <p className="detail-page-back">
          <Link href={backHref} className="btn btn-sm btn-ghost">
            {backLabel}
          </Link>
        </p>
      ) : null}
      <PageToolbar title={title} subtitle={subtitle} actions={actions} />
      <div
        className={`detail-page-grid${aside ? ' detail-page-grid--split' : ''}${className ? ` ${className}` : ''}`}
      >
        <div className="page-card stack-gap detail-page-main">{children}</div>
        {aside ? <aside className="page-card stack-gap detail-page-aside">{aside}</aside> : null}
      </div>
    </>
  );
}
