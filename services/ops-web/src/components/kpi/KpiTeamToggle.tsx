'use client';

export type KpiTeamOption = 'all' | 'sales' | 'solution' | 'cskh';

const OPTIONS: Array<{ value: KpiTeamOption; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'sales', label: 'Sales' },
  { value: 'solution', label: 'Solution' },
  { value: 'cskh', label: 'CSKH' },
];

export function KpiTeamToggle({
  value,
  onChange,
}: {
  value: KpiTeamOption;
  onChange: (next: KpiTeamOption) => void;
}) {
  return (
    <div className="kpi-team-toggle" role="group" aria-label="Lọc theo team">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`btn btn-sm${value === opt.value ? '' : ' btn-secondary'}`}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
