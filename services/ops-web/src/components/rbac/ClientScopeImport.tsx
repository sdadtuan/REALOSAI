'use client';

import { FormEvent, useState } from 'react';
import { importStaffUserClientScope } from '@/lib/api';

type Props = {
  token: string;
  onApplied?: () => void;
};

export function ClientScopeImport({ token, onApplied }: Props) {
  const [csv, setCsv] = useState('email,client_id\n');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<
    Array<{ email: string; client_ids: string[]; error?: string }>
  >([]);

  async function runImport(dryRun: boolean) {
    setBusy(true);
    setMessage('');
    try {
      const result = await importStaffUserClientScope(token, csv, dryRun);
      setPreview(result.preview ?? []);
      setMessage(
        dryRun
          ? `Preview ${result.rows} user(s) · ${result.errors?.length ?? 0} lỗi`
          : `Đã gán scope cho ${result.applied} user(s)`,
      );
      if (!dryRun && result.applied > 0) onApplied?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import thất bại');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void runImport(false);
  }

  return (
    <section className="page-card stack-gap">
      <h3 className="h6">Import client scope (CSV)</h3>
      <p className="muted">
        Định dạng: <code>email,client_id</code> — một dòng mỗi binding. User phải tồn tại trong roster.
      </p>
      <form className="stack-gap" onSubmit={onSubmit}>
        <textarea
          className="input"
          rows={8}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          spellCheck={false}
        />
        <div className="flex-gap">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void runImport(true)}>
            Preview
          </button>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Đang import…' : 'Import & gán'}
          </button>
        </div>
      </form>
      {message ? <p className="muted">{message}</p> : null}
      {preview.length ? (
        <ul className="muted">
          {preview.slice(0, 12).map((row) => (
            <li key={row.email}>
              {row.email}: {row.client_ids.join(', ')}
              {row.error ? ` (${row.error})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
