'use client';

import { formatPublishedValidTo, publishedValidToFromRow } from '@/lib/published-valid-to.util';
import { PublishedValidToNote } from '@/components/research/PublishedValidToNote';

export function ReportPublishedValidToList({
  findings,
  recs,
}: {
  findings?: unknown;
  recs?: unknown;
}) {
  const rows = [...(Array.isArray(findings) ? findings : []), ...(Array.isArray(recs) ? recs : [])];
  const notes = rows
    .map((row, i) => ({ key: i, value: publishedValidToFromRow(row) }))
    .filter((row) => formatPublishedValidTo(row.value));
  if (notes.length === 0) return null;
  return (
    <div data-testid="staff-published-valid-to-list">
      {notes.map((row) => (
        <PublishedValidToNote key={row.key} publishedValidTo={row.value} />
      ))}
    </div>
  );
}
