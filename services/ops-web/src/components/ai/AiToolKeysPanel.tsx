'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  createAiToolKey,
  fetchAiToolKeys,
  fetchAiToolsCatalog,
  revokeAiToolKey,
  type AiToolApiKey,
  type AiToolDescriptor,
  type CreateAiToolKeyResponse,
} from '@/lib/ai-api';

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

function statusLabel(key: AiToolApiKey): string {
  return key.is_active ? 'Active' : 'Revoked';
}

export function AiToolKeysPanel({ token }: { token: string }) {
  const [keys, setKeys] = useState<AiToolApiKey[]>([]);
  const [tools, setTools] = useState<AiToolDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateAiToolKeyResponse | null>(null);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [allowedTools, setAllowedTools] = useState<string[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [keysResponse, catalogResponse] = await Promise.all([
        fetchAiToolKeys(token),
        fetchAiToolsCatalog(token),
      ]);
      setKeys(keysResponse.keys ?? []);
      setTools(catalogResponse.tools ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải AI tool management thất bại');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openCreateModal() {
    setName('');
    setClientId('');
    setAllowedTools(tools.filter((tool) => !tool.mutating).map((tool) => tool.name));
    setCreatedKey(null);
    setError('');
    setMessage('');
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (busy) return;
    setCreateOpen(false);
    setCreatedKey(null);
  }

  function toggleTool(toolName: string) {
    setAllowedTools((current) =>
      current.includes(toolName)
        ? current.filter((item) => item !== toolName)
        : [...current, toolName],
    );
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const created = await createAiToolKey(token, {
        name: name.trim(),
        allowed_tools: allowedTools,
        client_id: clientId.trim() || null,
      });
      setCreatedKey(created);
      setMessage('Đã tạo key. Sao chép ngay — plaintext chỉ hiển thị một lần.');
      const response = await fetchAiToolKeys(token);
      setKeys(response.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo AI tool key thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(key: AiToolApiKey) {
    if (!window.confirm(`Thu hồi key "${key.name}" (${key.key_prefix}…)? Hành động này không thể hoàn tác.`)) {
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await revokeAiToolKey(token, key.id);
      setMessage(`Đã thu hồi key ${key.name}.`);
      const response = await fetchAiToolKeys(token);
      setKeys(response.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thu hồi AI tool key thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ai-tool-keys-panel">
      <div className="kpi-page__head">
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>AI tool keys</h2>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Scoped credentials for external agents · key values are never stored as plaintext
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal} disabled={loading}>
          + Tạo key
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      <div className="perf-table-wrap" style={{ marginTop: '1rem' }}>
        <table className="perf-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Prefix</th>
              <th>Client scope</th>
              <th>Allowed tools</th>
              <th>Rate limit</th>
              <th>Trạng thái</th>
              <th>Tạo lúc</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="muted">Đang tải…</td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">Chưa có AI tool key.</td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id}>
                  <td><strong>{key.name}</strong></td>
                  <td><code>{key.key_prefix}…</code></td>
                  <td>{key.client_id ?? 'All clients'}</td>
                  <td>{key.allowed_tools.join(', ') || '—'}</td>
                  <td>{key.rate_limit_per_min}/phút</td>
                  <td>
                    <span className={key.is_active ? 'ai-run-status ai-run-status--ok' : 'ai-run-status ai-run-status--muted'}>
                      {statusLabel(key)}
                    </span>
                  </td>
                  <td>{formatWhen(key.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      disabled={!key.is_active || busy}
                      onClick={() => void handleRevoke(key)}
                    >
                      Thu hồi
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <section className="card" style={{ padding: '1rem', marginTop: '1.25rem' }}>
        <h3 className="kpi-section-title" style={{ marginTop: 0 }}>Tool catalog</h3>
        <p className="muted">Registry hiện tại; catalog này chỉ đọc.</p>
        <div className="perf-table-wrap">
          <table className="perf-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Mutating</th>
                <th>Mô tả</th>
              </tr>
            </thead>
            <tbody>
              {tools.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">{loading ? 'Đang tải…' : 'Không có tool.'}</td>
                </tr>
              ) : (
                tools.map((tool) => (
                  <tr key={tool.name}>
                    <td><code>{tool.name}</code></td>
                    <td>{tool.mutating ? 'Yes' : 'No'}</td>
                    <td>{tool.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {createOpen ? (
        <div className="ai-dismiss-modal" role="presentation" onClick={closeCreateModal}>
          <div
            className="ai-dismiss-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-tool-key-create-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="ai-tool-key-create-title">
              {createdKey ? 'AI tool key đã tạo' : 'Tạo AI tool key'}
            </h4>
            {createdKey ? (
              <>
                <p className="muted">Plaintext chỉ hiển thị lần này. Lưu vào secret manager trước khi đóng.</p>
                <div
                  className="card"
                  style={{ padding: '0.75rem', borderColor: 'var(--accent)', overflowWrap: 'anywhere' }}
                >
                  <code style={{ userSelect: 'all' }}>{createdKey.key}</code>
                </div>
                <div className="ai-dismiss-modal__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(createdKey.key);
                      setMessage('Đã copy key vào clipboard.');
                    }}
                  >
                    Copy key
                  </button>
                  <button type="button" className="btn btn-primary" onClick={closeCreateModal}>
                    Đã lưu, đóng
                  </button>
                </div>
              </>
            ) : (
              <form className="ai-dismiss-modal__form" onSubmit={(event) => void handleCreate(event)}>
                <label className="ai-field">
                  <span className="muted">Tên key</span>
                  <input
                    className="kpi-input"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="External sales agent"
                    maxLength={128}
                    required
                    autoFocus
                  />
                </label>
                <label className="ai-field">
                  <span className="muted">Client ID (để trống = all clients)</span>
                  <input
                    className="kpi-input"
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    placeholder="UUID"
                  />
                </label>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend className="muted" style={{ marginBottom: '0.4rem' }}>Allowed tools</legend>
                  <div style={{ display: 'grid', gap: '0.4rem', maxHeight: 240, overflowY: 'auto' }}>
                    {tools.map((tool) => (
                      <label key={tool.name} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={allowedTools.includes(tool.name)}
                          onChange={() => toggleTool(tool.name)}
                        />
                        <span>
                          <code>{tool.name}</code>
                          {tool.mutating ? <span className="error"> · mutating</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="ai-dismiss-modal__actions">
                  <button type="button" className="btn btn-secondary" onClick={closeCreateModal} disabled={busy}>
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy || !name.trim() || allowedTools.length === 0}
                  >
                    {busy ? 'Đang tạo…' : 'Tạo key'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
