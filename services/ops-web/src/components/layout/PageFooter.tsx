import type { ReactNode } from 'react';

type PageFooterProps = {
  meta?: ReactNode;
  children?: ReactNode;
};

export function PageFooter({ meta, children }: PageFooterProps) {
  return (
    <div className="page-footer">
      {meta ? <div className="page-footer__meta muted">{meta}</div> : null}
      {children ? <div className="page-footer__actions">{children}</div> : null}
    </div>
  );
}
