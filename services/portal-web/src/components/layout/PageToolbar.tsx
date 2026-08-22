import type { ReactNode } from 'react';

type PageToolbarProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageToolbar({ title, subtitle, actions }: PageToolbarProps) {
  return (
    <div className="page-toolbar">
      <div className="page-toolbar__main">
        <h2 className="page-toolbar__title">{title}</h2>
        {subtitle ? <p className="page-toolbar__subtitle muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-toolbar__actions">{actions}</div> : null}
    </div>
  );
}
