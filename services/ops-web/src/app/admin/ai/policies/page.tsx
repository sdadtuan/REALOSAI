'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageShell } from '@/components/admin';
import { fetchAdminAiPolicies, patchAdminAiPolicy, type AdminAiPolicyRow } from '@/lib/api';
import { hasCap } from '@/lib/auth';
import { canViewPolicyAdmin, useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';

const PII_FIELDS = ['phone', 'email', 'national_id', 'address'];
const TOOL_OPTIONS = ['nl_query', 'lead_score', 'content_draft', 'campaign_optimize'];

function canViewAiPolicies(user: Parameters<typeof canViewPolicyAdmin>[0]): boolean {
  if (!user) return false;
  return hasCap(user, 'ai_admin', 'view') || canViewPolicyAdmin(user);
}

export default function AdminAiPoliciesPage() {
  const { user, token, error, loading, logout } = useAdminCrmAuth(canViewAiPolicies);
  const [policies, setPolicies] = useState<AdminAiPolicyRow[]>([]);
  const [missingCount, setMissingCount] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const canConfigure = hasCap(user, 'ai_admin', 'configure') || hasCap(user, 'crm_data_config', 'configure');

  const reload = useCallback(async () => {
    if (!token) return;
    setLoadError('');
    try {
      const out = await fetchAdminAiPolicies(token);
      setPolicies(out.policies ?? []);
      setMissingCount(out.agents_missing_policy ?? 0);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Tải AI policies thất bại');
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveRow(row: AdminAiPolicyRow) {
    if (!token || !canConfigure) return;
    setBusy(true);
    try {
      await patchAdminAiPolicy(token, row.agent_code, {
        allowed_tools: row.allowed_tools,
        spend_cap_usd_monthly: row.spend_cap_usd_monthly,
        pii_block_fields: row.pii_block_fields,
        require_human_approval: row.require_human_approval,
      });
      await reload();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Lưu policy thất bại');
    } finally {
      setBusy(false);
    }
  }

  function updateRow(agentCode: string, patch: Partial<AdminAiPolicyRow>) {
    setPolicies((prev) =>
      prev.map((row) => (row.agent_code === agentCode ? { ...row, ...patch } : row)),
    );
  }

  function toggleTool(row: AdminAiPolicyRow, tool: string) {
    const next = row.allowed_tools.includes(tool)
      ? row.allowed_tools.filter((t) => t !== tool)
      : [...row.allowed_tools, tool];
    updateRow(row.agent_code, { allowed_tools: next });
  }

  function togglePii(row: AdminAiPolicyRow, field: string) {
    const next = row.pii_block_fields.includes(field)
      ? row.pii_block_fields.filter((f) => f !== field)
      : [...row.pii_block_fields, field];
    updateRow(row.agent_code, { pii_block_fields: next });
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="AI governance"
      subtitle="Allowlist tool · spend cap · chặn PII"
      breadcrumb={[
        { label: 'Quản trị', href: '/admin' },
        { label: 'AI', href: '/admin/ai/agents' },
        { label: 'Policies' },
      ]}
      loading={loading}
    >
      <div className="admin-governance-page">
        {error ? <p className="form-error">{error}</p> : null}
        {loadError ? <p className="form-error">{loadError}</p> : null}

        <p className="muted">
          {policies.length} agent · {missingCount > 0 ? `${missingCount} thiếu policy` : 'Đủ policy'}
        </p>

        <table className="table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Tools cho phép</th>
              <th>Spend cap (USD/tháng)</th>
              <th>Chặn PII</th>
              <th>Duyệt người</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {policies.map((row) => (
              <tr key={row.agent_code}>
                <td>
                  <strong>{row.agent_code}</strong>
                  {row.agent_name ? <div className="muted">{row.agent_name}</div> : null}
                </td>
                <td>
                  <div className="win-filter-chips">
                    {TOOL_OPTIONS.map((tool) => (
                      <button
                        key={tool}
                        type="button"
                        className={`win-filter-chip${row.allowed_tools.includes(tool) ? ' win-filter-chip--active' : ''}`}
                        disabled={!canConfigure || busy}
                        onClick={() => toggleTool(row, tool)}
                      >
                        {tool}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="kpi-input"
                    disabled={!canConfigure || busy}
                    value={row.spend_cap_usd_monthly ?? ''}
                    onChange={(e) =>
                      updateRow(row.agent_code, {
                        spend_cap_usd_monthly: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td>
                  <div className="win-filter-chips">
                    {PII_FIELDS.map((field) => (
                      <button
                        key={field}
                        type="button"
                        className={`win-filter-chip${row.pii_block_fields.includes(field) ? ' win-filter-chip--active' : ''}`}
                        disabled={!canConfigure || busy}
                        onClick={() => togglePii(row, field)}
                      >
                        {field}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.require_human_approval}
                    disabled={!canConfigure || busy}
                    onChange={(e) => updateRow(row.agent_code, { require_human_approval: e.target.checked })}
                  />
                </td>
                <td>
                  {canConfigure ? (
                    <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void saveRow(row)}>
                      Lưu
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {policies.length === 0 ? <p className="muted">Chưa có agent policy.</p> : null}
      </div>
    </AdminPageShell>
  );
}
