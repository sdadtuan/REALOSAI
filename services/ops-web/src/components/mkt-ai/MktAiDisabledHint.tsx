'use client';

import type { ReactElement } from 'react';

interface Props {
  disabled?: boolean;
  title: string;
  children: ReactElement;
}

/** VQ-04 — tooltips on cap-disabled controls (wrap disabled buttons). */
export function MktAiDisabledHint({ disabled, title, children }: Props) {
  if (!disabled) return children;
  return (
    <span title={title} style={{ display: 'inline-flex', cursor: 'not-allowed' }}>
      {children}
    </span>
  );
}
