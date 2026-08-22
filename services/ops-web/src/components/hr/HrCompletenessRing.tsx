'use client';

type Props = {
  pct: number;
  size?: number;
  label?: string;
};

export function HrCompletenessRing({ pct, size = 40, label }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className="hr-completeness-ring"
      style={{ width: size, height: size, position: 'relative' }}
      title={label ?? `${clamped}% hồ sơ`}
      aria-label={label ?? `${clamped}% hồ sơ`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.65rem',
          fontWeight: 700,
        }}
      >
        {clamped}%
      </span>
    </div>
  );
}
