'use client';

import { useCallback, useState } from 'react';
import {
  activateAutomationWorkflow,
  createAutomationWorkflow,
  simulateAutomationWorkflow,
  updateAutomationWorkflowNodes,
  type AutomationNodeType,
  type AutomationWorkflowNode,
  type AutomationWorkflowRow,
  type SimulateStep,
} from '@/lib/automation-api';

const NODE_LABELS: Record<string, string> = {
  trigger: 'Trigger',
  ai_score: 'AI score lead',
  ai_summarize: 'AI summarize',
  delay: 'Delay',
  assign_task: 'Assign task',
  condition: 'Condition',
};

export interface AutomationWorkflowsPanelProps {
  token: string;
  canConfigure: boolean;
  canSimulate: boolean;
  initialRows: AutomationWorkflowRow[];
  initialTotal: number;
  onReload: () => Promise<void>;
}

export function AutomationWorkflowsPanel({
  token,
  canConfigure,
  canSimulate,
  initialRows,
  initialTotal,
  onReload,
}: AutomationWorkflowsPanelProps) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [selected, setSelected] = useState<AutomationWorkflowRow | null>(null);
  const [nodes, setNodes] = useState<AutomationWorkflowNode[]>([]);
  const [simulateLeadId, setSimulateLeadId] = useState('1');
  const [simulateSteps, setSimulateSteps] = useState<SimulateStep[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadDetail = useCallback(
    async (row: AutomationWorkflowRow) => {
      setSelected(row);
      setSimulateSteps(null);
      setMessage('');
      const { fetchAutomationWorkflowById } = await import('@/lib/automation-api');
      const detail = await fetchAutomationWorkflowById(token, row.id);
      setNodes(detail.data.nodes);
    },
    [token],
  );

  const handleCreate = async () => {
    if (!canConfigure) return;
    setBusy(true);
    setMessage('');
    try {
      const created = await createAutomationWorkflow(token, {
        name: `Workflow ${new Date().toLocaleDateString('vi-VN')}`,
        trigger_event: 'lead.created',
      });
      await onReload();
      setRows((prev) => [created.data.workflow, ...prev]);
      setTotal((t) => t + 1);
      await loadDetail(created.data.workflow);
      setMessage('Đã tạo workflow draft.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không tạo được workflow');
    } finally {
      setBusy(false);
    }
  };

  const handleAddAiScoreNode = async () => {
    if (!selected || !canConfigure) return;
    const nextKey = `ai_score_${nodes.length + 1}`;
    const draftNodes = [
      ...nodes.map((n, idx) => ({
        node_key: n.node_key,
        node_type: n.node_type as AutomationNodeType,
        config_json: n.config_json,
        next_node_key: n.next_node_key,
        sort_order: idx,
      })),
      {
        node_key: nextKey,
        node_type: 'ai_score' as AutomationNodeType,
        config_json: {},
        next_node_key: null,
        sort_order: nodes.length,
      },
    ];
    setBusy(true);
    try {
      const updated = await updateAutomationWorkflowNodes(token, selected.id, draftNodes);
      setNodes(updated.data.nodes);
      setMessage('Đã thêm node AI score.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không cập nhật nodes');
    } finally {
      setBusy(false);
    }
  };

  const handleSimulate = async () => {
    if (!selected || !canSimulate) return;
    const leadId = Number(simulateLeadId);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      setMessage('Lead ID không hợp lệ');
      return;
    }
    setBusy(true);
    setSimulateSteps(null);
    try {
      const out = await simulateAutomationWorkflow(token, selected.id, { lead_id: leadId });
      setSimulateSteps(out.data.steps);
      setMessage('Simulate dry-run — không ghi prod.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Simulate thất bại');
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!selected || !canConfigure) return;
    setBusy(true);
    try {
      const out = await activateAutomationWorkflow(token, selected.id);
      setSelected(out.data.workflow);
      setRows((prev) => prev.map((r) => (r.id === out.data.workflow.id ? out.data.workflow : r)));
      setMessage('Workflow đã publish (active).');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Publish thất bại');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="automation-workflows-panel">
      <div className="automation-workflows-toolbar">
        <p className="muted">
          RNOS-13…15 · Workflow builder + AI nodes · Simulate không mutate prod (§19.2)
        </p>
        {canConfigure ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleCreate()}>
            + Workflow mới
          </button>
        ) : null}
      </div>

      {message ? <p className="automation-workflows-message">{message}</p> : null}

      <div className="automation-workflows-layout">
        <div className="automation-workflows-list card">
          <h3>Danh sách ({total})</h3>
          <table className="automation-workflows-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={selected?.id === row.id ? 'is-selected' : ''}
                  onClick={() => void loadDetail(row)}
                >
                  <td>{row.name}</td>
                  <td>
                    <span className={`automation-status automation-status-${row.status}`}>{row.status}</span>
                  </td>
                  <td>{new Date(row.updated_at).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Chưa có workflow — tạo mới hoặc apply DDL automation_workflows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="automation-workflows-detail card">
          {!selected ? (
            <p className="muted">Chọn workflow để chỉnh nodes và simulate.</p>
          ) : (
            <>
              <h3>{selected.name}</h3>
              <p className="muted">
                Trigger: {(selected.definition_json.trigger_event as string) || 'lead.created'} · v{selected.version}
              </p>
              <ol className="automation-node-list">
                {nodes.map((node) => (
                  <li key={node.id || node.node_key}>
                    <strong>{NODE_LABELS[node.node_type] ?? node.node_type}</strong>
                    <span className="muted"> ({node.node_key})</span>
                  </li>
                ))}
              </ol>
              {canConfigure && selected.status !== 'active' ? (
                <div className="automation-workflows-actions">
                  <button type="button" className="btn" disabled={busy} onClick={() => void handleAddAiScoreNode()}>
                    + AI score node
                  </button>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handlePublish()}>
                    Publish
                  </button>
                </div>
              ) : null}
              {canSimulate ? (
                <div className="automation-simulate-panel">
                  <h4>Simulate (dry-run)</h4>
                  <label>
                    Lead ID{' '}
                    <input
                      type="number"
                      min={1}
                      value={simulateLeadId}
                      onChange={(e) => setSimulateLeadId(e.target.value)}
                    />
                  </label>
                  <button type="button" className="btn" disabled={busy} onClick={() => void handleSimulate()}>
                    Chạy simulate
                  </button>
                  {simulateSteps ? (
                    <pre className="automation-simulate-output">{JSON.stringify(simulateSteps, null, 2)}</pre>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
