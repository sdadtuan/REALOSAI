'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DraftAutosaveHint } from '@/components/mkt-ai/DraftAutosaveHint';
import { useIntakeAutosave } from '@/lib/crm/use-intake-autosave';
import { patchMktAiDraft, type MktAiDraft, type MktAiKpiTreeNode } from '@/lib/mkt-ai-planner-api';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.45rem 0.65rem',
  color: 'var(--text)',
  width: '100%',
  fontSize: '0.85rem',
};

interface Props {
  token: string;
  lifecycleId: number;
  kpiTree: MktAiKpiTreeNode[];
  canEdit: boolean;
  paused?: boolean;
  resetAutosaveKey?: string | number;
  onDraftPersisted: (draft: MktAiDraft) => void;
  onSaveError?: (message: string) => void;
}

function kpiTreeSnapshot(nodes: MktAiKpiTreeNode[]): string {
  return JSON.stringify(nodes ?? []);
}

function defaultTree(): MktAiKpiTreeNode[] {
  return [
    {
      id: 'north_star',
      label: 'North Star KPI',
      target: '',
      unit: '',
      children: [{ id: 'campaign_0', label: 'Campaign chính', target: '', unit: '' }],
    },
  ];
}

export function AiKpiTreeEditor({
  token,
  lifecycleId,
  kpiTree,
  canEdit,
  paused = false,
  resetAutosaveKey,
  onDraftPersisted,
  onSaveError,
}: Props) {
  const [tree, setTree] = useState<MktAiKpiTreeNode[]>(
    kpiTree?.length ? kpiTree : defaultTree(),
  );

  useEffect(() => {
    setTree(kpiTree?.length ? kpiTree : defaultTree());
  }, [resetAutosaveKey, kpiTree]);

  const snapshot = useMemo(() => kpiTreeSnapshot(tree), [tree]);

  const persistTree = useCallback(async () => {
    const saved = await patchMktAiDraft(token, lifecycleId, { kpi_tree_json: tree });
    onDraftPersisted(saved);
  }, [lifecycleId, onDraftPersisted, token, tree]);

  const autosave = useIntakeAutosave({
    enabled: canEdit,
    paused,
    snapshot,
    onSave: persistTree,
    debounceMs: 900,
  });

  const root = tree[0] ?? defaultTree()[0];
  const children = root.children ?? [];

  function updateRoot(patch: Partial<MktAiKpiTreeNode>) {
    setTree([{ ...root, ...patch, children }]);
  }

  function updateChild(index: number, patch: Partial<MktAiKpiTreeNode>) {
    const next = children.map((c, i) => (i === index ? { ...c, ...patch } : c));
    setTree([{ ...root, children: next }]);
  }

  function addChild() {
    const next = [
      ...children,
      { id: `campaign_${children.length}`, label: '', target: '', unit: '' },
    ];
    setTree([{ ...root, children: next }]);
  }

  return (
    <div
      className="card"
      style={{ padding: '1rem', display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>KPI tree (North Star → Campaign)</h4>
        {canEdit ? (
          <DraftAutosaveHint
            status={autosave.status}
            savedAt={autosave.savedAt}
            dirty={autosave.dirty}
            entityLabel="KPI tree"
          />
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          North Star
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
          <input
            style={inputStyle}
            placeholder="Tên KPI (vd: CPL)"
            value={root.label ?? ''}
            disabled={!canEdit || paused}
            onChange={(e) => updateRoot({ label: e.target.value })}
            onBlur={() => autosave.saveOnBlur()}
          />
          <input
            style={inputStyle}
            placeholder="Target"
            value={root.target ?? ''}
            disabled={!canEdit || paused}
            onChange={(e) => updateRoot({ target: e.target.value })}
            onBlur={() => autosave.saveOnBlur()}
          />
          <input
            style={inputStyle}
            placeholder="Đơn vị"
            value={root.unit ?? ''}
            disabled={!canEdit || paused}
            onChange={(e) => updateRoot({ unit: e.target.value })}
            onBlur={() => autosave.saveOnBlur()}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          Campaign KPIs
        </span>
        {children.map((child, i) => (
          <div
            key={child.id ?? i}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.5rem',
              padding: '0.5rem',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}
          >
            <input
              style={inputStyle}
              placeholder="Campaign"
              value={child.label ?? ''}
              disabled={!canEdit || paused}
              onChange={(e) => updateChild(i, { label: e.target.value })}
              onBlur={() => autosave.saveOnBlur()}
            />
            <input
              style={inputStyle}
              placeholder="Target KPI"
              value={child.target ?? ''}
              disabled={!canEdit || paused}
              onChange={(e) => updateChild(i, { target: e.target.value })}
              onBlur={() => autosave.saveOnBlur()}
            />
          </div>
        ))}
        {canEdit ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => addChild()}>
            + Campaign KPI
          </button>
        ) : null}
      </div>
    </div>
  );
}
