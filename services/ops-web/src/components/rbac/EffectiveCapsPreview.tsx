import type { StaffUserEffectiveCaps } from '@/lib/api';

type Props = {
  preview: StaffUserEffectiveCaps | null;
  loading?: boolean;
};

export function EffectiveCapsPreview({ preview, loading }: Props) {
  if (loading) return <p className="muted">Đang tải effective caps…</p>;
  if (!preview) return null;

  const grouped = new Map<string, string[]>();
  for (const cap of preview.caps) {
    const list = grouped.get(cap.section) ?? [];
    list.push(cap.action);
    grouped.set(cap.section, list);
  }

  return (
    <section className="effective-caps-preview stack-gap">
      <div>
        <h3 className="section-title">Effective caps preview</h3>
        <p className="muted" style={{ margin: 0 }}>
          {preview.position_code ?? `position_id=${preview.position_id}`}
          {preview.job_functions.length
            ? ` · functions: ${preview.job_functions.join(', ')}`
            : ' · không có job function add-on'}
          {preview.permission_sets?.length
            ? ` · sets: ${preview.permission_sets.join(', ')}`
            : ''}
        </p>
      </div>
      <div className="table-scroll">
        <table className="data-table data-table--compact">
          <thead>
            <tr>
              <th>Section</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...grouped.entries()].slice(0, 24).map(([section, actions]) => (
              <tr key={section}>
                <td>{section}</td>
                <td className="muted">{[...new Set(actions)].sort().join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grouped.size > 24 ? (
        <p className="muted">Hiển thị 24/{grouped.size} sections — đầy đủ sau khi lưu + re-login.</p>
      ) : null}
    </section>
  );
}
