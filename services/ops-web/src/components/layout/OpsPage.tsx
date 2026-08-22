import type { ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb';

type OpsPageProps = {
  breadcrumb?: BreadcrumbItem[];
  children: ReactNode;
  width?: 'default' | 'wide' | 'narrow' | 'full';
};

export function OpsPage({ breadcrumb, children, width = 'wide' }: OpsPageProps) {
  return (
    <main className={`ops-page ops-page--${width} bitrix-crm-page`}>
      <div className="bitrix-crm-page__inner">
        {breadcrumb?.length ? <Breadcrumb items={breadcrumb} /> : null}
        {children}
      </div>
    </main>
  );
}
