'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LeadCopilotContext } from '@/lib/api';
import { fetchLeadPresalesConsultBrief } from '@/lib/api';

const TEMPERATURE_PROMPTS: Record<string, string[]> = {
  hot: [
    'Xác nhận timeline và người ký trong 15 phút đầu',
    'Chốt pain quant + ROI so với status quo',
    'Đề xuất buổi Solution trong 48h — anchor TC',
  ],
  warm: [
    'Làm rõ budget range và decision process',
    'Reframe pain bằng case ngành tương tự',
    'Gợi ý pilot CB để giảm rủi ro',
  ],
  cold: [
    'Khám phá thêm need — tránh pitch sớm',
    'Hỏi điều gì đã thử và vì sao chưa hiệu quả',
    'Đặt mốc follow-up cụ thể, không ép chốt',
  ],
};

type Props = {
  token: string;
  leadId: number;
  copilotContext?: LeadCopilotContext | null;
  loading?: boolean;
};

export function MeetingPrepCopilotSection({ token, leadId, copilotContext, loading }: Props) {
  const [temperature, setTemperature] = useState<string>('warm');
  const prep = copilotContext?.meeting_prep;

  const loadTemperature = useCallback(async () => {
    try {
      const out = await fetchLeadPresalesConsultBrief(token, leadId);
      const brief = out.brief as { readiness?: { temperature_label?: string } } | undefined;
      const label = String(brief?.readiness?.temperature_label ?? '').toLowerCase();
      if (label.includes('hot') || label.includes('nóng')) setTemperature('hot');
      else if (label.includes('cold') || label.includes('lạnh')) setTemperature('cold');
      else setTemperature('warm');
    } catch {
      setTemperature('warm');
    }
  }, [token, leadId]);

  useEffect(() => {
    void loadTemperature();
  }, [loadTemperature]);

  if (loading) {
    return <p className="muted">Đang tải prep call…</p>;
  }

  if (!prep?.summary && prep?.status !== 'ready') {
    return (
      <p className="muted">
        Chưa có SCI prep — chạy Meeting Prep trước cuộc gọi qualify/handoff.
      </p>
    );
  }

  const prompts = TEMPERATURE_PROMPTS[temperature] ?? TEMPERATURE_PROMPTS.warm;

  return (
    <section className="copilot-meeting-prep stack-gap" aria-label="Chuẩn bị call 15 phút">
      <h3 className="copilot-section-title">Chuẩn bị call 15p (SCI)</h3>
      {prep?.close_readiness_score != null ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Readiness {prep.close_readiness_score}/100 · stage {prep.prep_stage ?? '—'}
        </p>
      ) : null}
      {prep?.summary ? (
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
          {prep.summary.length > 280 ? `${prep.summary.slice(0, 280)}…` : prep.summary}
        </p>
      ) : null}
      {prep?.top_dv_codes?.length ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          DV gợi ý: {prep.top_dv_codes.join(', ')}
        </p>
      ) : null}
      <div>
        <span className="muted">Gợi ý theo nhiệt độ lead ({temperature})</span>
        <ol className="lmp-m2-copilot-prompts">
          {prompts.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
