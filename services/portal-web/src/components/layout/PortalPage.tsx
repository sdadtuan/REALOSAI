import type { ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb';

type PortalPageProps = {
  breadcrumb?: BreadcrumbItem[];
  children: ReactNode;
  width?: 'default' | 'wide' | 'narrow';
};

export function PortalPage({ breadcrumb, children, width = 'wide' }: PortalPageProps) {
  return (
    <main className={`portal-page portal-page--${width}`}>
      {breadcrumb?.length ? <Breadcrumb items={breadcrumb} /> : null}
      {children}
    </main>
  );
}
