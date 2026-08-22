'use client';

import { useState } from 'react';
import { canExportFormat, getQualityTier } from '@/lib/mkt-ai-quality-labels';
import type { MktAiPptxExportSection } from '@/lib/mkt-ai-planner-api';
import type { QualityScoreView } from '@/components/mkt-ai/AiQualityScoreCard';

const PPTX_SECTIONS: Array<{ id: MktAiPptxExportSection; label: string }> = [
  { id: 'brief', label: 'Brief' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'campaign', label: 'Campaign' },
  { id: 'content', label: 'Content' },
];

interface Props {
  quality: QualityScoreView | null | undefined;
  canExport: boolean;
  exportPptxEnabled?: boolean;
  approvalRequired?: boolean;
  approvalCanExport?: boolean;
  busy?: boolean;
  onExport: (format: 'pdf' | 'docx' | 'xlsx') => void;
  onExportPptx?: (sections: MktAiPptxExportSection[]) => void;
}

export function ExportPlanActions({
  quality,
  canExport,
  exportPptxEnabled = false,
  approvalRequired = false,
  approvalCanExport = true,
  busy = false,
  onExport,
  onExportPptx,
}: Props) {
  const score = quality?.score;
  const tier = getQualityTier(score);
  const exportBlockedByApproval = approvalRequired && !approvalCanExport;
  const [pptxSections, setPptxSections] = useState<MktAiPptxExportSection[]>([
    'strategy',
    'campaign',
  ]);

  if (!canExport) {
    return (
      <section style={{ display: 'grid', gap: '0.35rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Export kế hoạch</h4>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Cần quyền <code>crm_mkt_ai.export</code> để tải file.
        </p>
      </section>
    );
  }

  const formats: Array<{ id: 'pdf' | 'docx' | 'xlsx'; label: string; hint?: string }> = [
    { id: 'pdf', label: 'PDF Kế hoạch', hint: 'Tóm tắt chiến lược + campaigns + lịch' },
    { id: 'docx', label: 'DOCX', hint: 'Bản chỉnh sửa đầy đủ trong Word' },
    { id: 'xlsx', label: 'Excel KPI tree', hint: 'Sheets KPI + campaigns + TMMT' },
  ];

  function togglePptxSection(id: MktAiPptxExportSection) {
    setPptxSections((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        return next.length ? next : prev;
      }
      return [...prev, id];
    });
  }

  const pptxEnabled =
    exportPptxEnabled &&
    Boolean(onExportPptx) &&
    canExportFormat('pptx', score) &&
    !exportBlockedByApproval;

  return (
    <section style={{ display: 'grid', gap: '0.5rem' }}>
      <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Export kế hoạch</h4>
      {tier === 'blocked' ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Export bị khóa khi quality &lt;60. Hoàn thiện brief, ICP và campaign trước.
        </p>
      ) : tier === 'conditional' ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Điểm 60–69: chỉ export DOCX (BR-MKTP-05).
        </p>
      ) : exportBlockedByApproval ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Export cần MKT Lead duyệt trước (BR-MKTP-09). Gửi duyệt trên thanh phía trên.
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {formats.map((f) => {
          const enabled = canExportFormat(f.id, score) && !exportBlockedByApproval;
          return (
            <button
              key={f.id}
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy || !enabled}
              title={
                exportBlockedByApproval
                  ? 'Cần MKT Lead duyệt trước khi export'
                  : !canExport
                    ? 'Cần quyền crm_mkt_ai.export'
                    : !enabled && tier === 'conditional'
                      ? 'Chỉ DOCX khi điểm 60–69'
                      : !enabled
                        ? 'Cần quality ≥60'
                        : f.hint
              }
              onClick={() => onExport(f.id)}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {exportPptxEnabled && onExportPptx ? (
        <div
          style={{
            display: 'grid',
            gap: '0.45rem',
            padding: '0.65rem 0.75rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>PPTX Kế hoạch</div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            {PPTX_SECTIONS.map((s) => (
              <label key={s.id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={pptxSections.includes(s.id)}
                  disabled={busy || !pptxEnabled}
                  onChange={() => togglePptxSection(s.id)}
                />
                {s.label}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={busy || !pptxEnabled || pptxSections.length === 0}
            title={
              exportBlockedByApproval
                ? 'Cần MKT Lead duyệt trước khi export'
                : tier === 'conditional'
                  ? 'PPTX cần quality ≥70'
                  : 'Tải slide deck theo sections đã chọn'
            }
            onClick={() => onExportPptx(pptxSections)}
          >
            Tải PPTX ({pptxSections.length} section)
          </button>
        </div>
      ) : null}
    </section>
  );
}
