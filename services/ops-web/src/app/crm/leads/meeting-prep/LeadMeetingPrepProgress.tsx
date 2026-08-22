'use client';

import type { LeadMeetingPrepStatus } from './lead-meeting-prep.types';

const STEPS = [
  { key: 'collect', label: 'Thu thập' },
  { key: 'verify', label: 'Xác minh' },
  { key: 'strategize', label: 'Chiến lược' },
  { key: 'arm', label: 'Vũ trang' },
] as const;

function stepIndex(status: LeadMeetingPrepStatus, completed: string[]): number {
  if (status === 'ready' || status === 'failed') return 4;
  if (status === 'awaiting_entity_choice') return 2;
  if (completed.includes('arm')) return 4;
  if (completed.includes('strategize')) return 3;
  if (completed.includes('verify')) return 2;
  if (completed.includes('collect') || status === 'running') return 1;
  if (status === 'pending') return 0;
  return 0;
}

type Props = {
  status: LeadMeetingPrepStatus;
  stepsCompleted?: string[];
  message?: string;
};

export function LeadMeetingPrepProgress({ status, stepsCompleted = [], message }: Props) {
  const active = stepIndex(status, stepsCompleted);

  if (status === 'skipped' || status === 'none') {
    return (
      <div className="lmp-progress lmp-progress--muted">
        <span>{message || 'Chưa chạy prep'}</span>
      </div>
    );
  }

  return (
    <div className="lmp-progress" aria-label="Tiến trình prep">
      <ol className="lmp-progress__track">
        {STEPS.map((step, idx) => {
          const done = active > idx || (status === 'ready' && idx < 4);
          const current =
            active === idx + 1 || (status === 'running' && idx === 0 && active === 1);
          return (
            <li
              key={step.key}
              className={[
                'lmp-progress__step',
                done ? 'is-done' : '',
                current ? 'is-current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="lmp-progress__dot" aria-hidden />
              <span className="lmp-progress__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
      {message ? <p className="lmp-progress__msg muted">{message}</p> : null}
    </div>
  );
}
