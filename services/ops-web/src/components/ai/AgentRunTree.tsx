'use client';

import type { AiAgentRunRow, AiAgentRunStatus } from '@/lib/ai-api';

function statusClass(status: AiAgentRunStatus): string {
  if (status === 'succeeded') return 'ai-run-status ai-run-status--ok';
  if (status === 'failed') return 'ai-run-status ai-run-status--fail';
  if (status === 'running') return 'ai-run-status ai-run-status--run';
  return 'ai-run-status ai-run-status--muted';
}

function formatLatency(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return `${Math.round(ms)} ms`;
}

function RunSummary({ run, isParent }: { run: AiAgentRunRow; isParent?: boolean }) {
  return (
    <span className="agent-run-tree__summary">
      <span>
        <strong>{isParent ? 'orchestrator' : (run.step_key ?? run.agent_name)}</strong>
        <span className="muted">
          {isParent ? run.use_case : `${run.agent_name} · ${run.use_case ?? '—'}`}
        </span>
      </span>
      <span>{formatLatency(run.latency_ms)}</span>
      <span className={statusClass(run.status)}>{run.status}</span>
    </span>
  );
}

export function AgentRunTree({
  parentRun,
  children,
}: {
  parentRun: AiAgentRunRow | null;
  children: AiAgentRunRow[];
}) {
  if (!parentRun) {
    return <p className="muted">Không tìm thấy parent run cho orchestration này.</p>;
  }

  const orderedChildren = [...children].sort(
    (a, b) => (a.step_index ?? Number.MAX_SAFE_INTEGER) - (b.step_index ?? Number.MAX_SAFE_INTEGER),
  );

  return (
    <div className="agent-run-tree" role="tree" aria-label="Orchestration agent runs">
      <div className="agent-run-tree__parent" role="treeitem" aria-expanded="true">
        <RunSummary run={parentRun} isParent />
      </div>
      <div className="agent-run-tree__children" role="group">
        {orderedChildren.length === 0 ? (
          <p className="muted">Chưa có child run.</p>
        ) : (
          orderedChildren.map((run) => (
            <details className="agent-run-tree__child" key={run.id} role="treeitem">
              <summary>
                <RunSummary run={run} />
              </summary>
              <div className="agent-run-tree__payload">
                {run.error_message ? <p className="error">{run.error_message}</p> : null}
                <p className="muted">
                  Payload đã được backend áp dụng BR-AI-05 redaction trước khi lưu.
                </p>
                <pre>
                  {JSON.stringify(
                    { input_json: run.input_json, output_json: run.output_json },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
