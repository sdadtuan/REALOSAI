'use client';

import { PUBLISHED_VALID_TO_LABEL, formatPublishedValidTo } from '@/lib/published-valid-to.util';

export function PublishedValidToNote({ publishedValidTo }: { publishedValidTo?: unknown }) {
  const day = formatPublishedValidTo(publishedValidTo);
  if (!day) return null;
  return (
    <p
      className="muted"
      data-testid="published-valid-to"
      style={{ margin: '0.25rem 0 0', fontSize: '0.82rem' }}
    >
      {PUBLISHED_VALID_TO_LABEL}: {day}
    </p>
  );
}
