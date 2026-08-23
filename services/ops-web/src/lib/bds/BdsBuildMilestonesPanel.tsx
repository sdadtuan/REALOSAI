'use client';

import type { BdsMilestone } from './types';
import { buildMilestoneStatusLabel } from './finance-copy';

type Props = {
  milestones: BdsMilestone[];
};

export function BdsBuildMilestonesPanel({ milestones }: Props) {
  if (milestones.length === 0) return null;
  return (
    <section className="bds-build-milestones" aria-label="Mốc thi công dự án">
      <h4 className="bds-build-milestones__title">Mốc thi công · lịch thanh toán</h4>
      <p className="muted bds-build-milestones__hint">
        Đợt thu gắn mốc qua chỉ số đợt CSBH — không thay ERP kế toán.
      </p>
      <ul className="bds-build-milestones__list">
        {milestones.map((m) => (
          <li key={m.id} className={`bds-build-milestones__item bds-build-milestones__item--${m.status}`}>
            <div className="bds-build-milestones__head">
              <strong>{m.name || m.code}</strong>
              <span className="badge">{buildMilestoneStatusLabel(m.status)}</span>
            </div>
            <p className="muted bds-build-milestones__meta">
              {m.code}
              {m.unlocks_installment_index != null ? ` · mở đợt #${m.unlocks_installment_index + 1}` : ''}
              {m.target_date ? ` · KH ${m.target_date.slice(0, 10)}` : ''}
              {m.actual_date ? ` · TT ${m.actual_date.slice(0, 10)}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
