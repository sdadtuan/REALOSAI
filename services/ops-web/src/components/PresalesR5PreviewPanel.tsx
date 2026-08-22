'use client';

const STRATEGY_LABELS: Record<string, string> = {
  target_market: 'Thị trường mục tiêu',
  market_message: 'Thông điệp thị trường',
  media_reach: 'Kênh tiếp cận / Media',
  conversion_strategy: 'Chiến lược chuyển đổi',
  retention_system: 'Hệ thống giữ chân',
  nurture_system: 'Nuôi dưỡng lead',
  world_class_experience: 'Trải nghiệm đẳng cấp',
  lifecycle_extension: 'Gia hạn lifecycle',
  referral_engine: 'Giới thiệu / Referral',
};

interface Props {
  planName: string;
  planNorthStar: string;
  planObjectives: string;
  planStrategy: Record<string, string>;
  planValidation: string[];
  stage: 'consult' | 'proposal';
  onEditR5?: () => void;
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="presales-r5-preview__field">
      <span className="presales-r5-preview__label">{label}</span>
      <p className="presales-r5-preview__value">{value.trim() || '—'}</p>
    </div>
  );
}

export function PresalesR5PreviewPanel({
  planName,
  planNorthStar,
  planObjectives,
  planStrategy,
  planValidation,
  stage,
  onEditR5,
}: Props) {
  return (
    <section className="presales-r5-preview stack-gap" id="funnel-presales-r5-preview" aria-label="R5 preview">
      <div className="presales-r5-preview__head">
        <h4 style={{ margin: 0 }}>KH Marketing sơ bộ (R5)</h4>
        {stage === 'proposal' && onEditR5 ? (
          <button type="button" className="btn btn-sm btn-secondary" onClick={onEditR5}>
            Sửa R5 →
          </button>
        ) : null}
        {stage === 'consult' && onEditR5 ? (
          <button type="button" className="btn btn-sm btn-link" onClick={onEditR5}>
            Chỉnh sửa trên Tổng quan →
          </button>
        ) : null}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Xem nhanh · gate G4 cần R5 đủ trước <strong>Chuyển → Báo giá</strong>.
      </p>
      {planValidation.length > 0 ? (
        <ul className="muted" style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.1rem' }}>
          {planValidation.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
      <ReadField label="Tên kế hoạch" value={planName} />
      <ReadField label="North Star" value={planNorthStar} />
      <ReadField label="Mục tiêu chiến lược" value={planObjectives} />
      {Object.entries(STRATEGY_LABELS).map(([key, label]) => (
        <ReadField key={key} label={label} value={planStrategy[key] ?? ''} />
      ))}
    </section>
  );
}
