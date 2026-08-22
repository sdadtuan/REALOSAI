'use client';

import { useEffect, useState } from 'react';
import {
  fetchContentOsVersionCompare,
  type ContentOsItemVersion,
  type ContentOsVersionDiffLine,
} from '@/lib/content-os-api';

interface Props {
  token: string;
  lifecycleId: number;
  itemId: number;
  versions: ContentOsItemVersion[];
  onError: (msg: string) => void;
}

export function ContentOsVersionDiff({
  token,
  lifecycleId,
  itemId,
  versions,
  onError,
}: Props) {
  const sorted = [...versions].sort((a, b) => b.version_no - a.version_no);
  const [v1, setV1] = useState(String(sorted[1]?.version_no ?? sorted[0]?.version_no ?? ''));
  const [v2, setV2] = useState(String(sorted[0]?.version_no ?? ''));
  const [lines, setLines] = useState<ContentOsVersionDiffLine[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!v1 || !v2 || v1 === v2) {
      setLines([]);
      return;
    }
    void (async () => {
      setLoading(true);
      onError('');
      try {
        const res = await fetchContentOsVersionCompare(
          token,
          lifecycleId,
          itemId,
          Number(v1),
          Number(v2),
        );
        setLines(res.lines);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'So sánh version thất bại');
        setLines([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, lifecycleId, itemId, v1, v2, onError]);

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '0.35rem',
    color: 'var(--text)',
  };

  if (versions.length < 2) {
    return <p className="muted" style={{ fontSize: '0.82rem' }}>Cần ≥2 versions để compare.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Diff markdown</strong>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.82rem' }}>
          <span className="muted">Từ v</span>
          <select value={v1} onChange={(e) => setV1(e.target.value)} style={selectStyle}>
            {sorted.map((v) => (
              <option key={v.version_no} value={v.version_no}>
                v{v.version_no}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', fontSize: '0.82rem' }}>
          <span className="muted">→ v</span>
          <select value={v2} onChange={(e) => setV2(e.target.value)} style={selectStyle}>
            {sorted.map((v) => (
              <option key={v.version_no} value={v.version_no}>
                v{v.version_no}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? <p className="muted">Đang tải diff…</p> : null}
      <pre
        style={{
          margin: 0,
          padding: '0.55rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          fontSize: '0.78rem',
          overflow: 'auto',
          maxHeight: 320,
        }}
      >
        {lines.map((line, idx) => (
          <div
            key={`${idx}-${line.type}-${line.text.slice(0, 20)}`}
            style={{
              color:
                line.type === 'add'
                  ? 'var(--success, #2ecc71)'
                  : line.type === 'del'
                    ? 'var(--danger, #e74c3c)'
                    : 'var(--text)',
              textDecoration: line.type === 'del' ? 'line-through' : undefined,
            }}
          >
            {line.type === 'add' ? '+ ' : line.type === 'del' ? '- ' : '  '}
            {line.text || ' '}
          </div>
        ))}
        {!lines.length && !loading ? <span className="muted">Chọn 2 version khác nhau.</span> : null}
      </pre>
    </div>
  );
}
