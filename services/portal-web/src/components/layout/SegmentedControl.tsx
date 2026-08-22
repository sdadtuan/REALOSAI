type SegmentedOption<T extends string> = {
  id: T;
  label: string;
  badge?: number | string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`segmented-control${className ? ` ${className}` : ''}`}
      role={label ? 'group' : 'tablist'}
      aria-label={label}
    >
      {label ? <span className="segmented-control__label">{label}</span> : null}
      <div className="segmented-control__track">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role={label ? undefined : 'tab'}
            aria-pressed={value === opt.id}
            className={`segmented-control__item${value === opt.id ? ' is-active' : ''}`}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
            {opt.badge != null && Number(opt.badge) > 0 ? (
              <span className="segmented-control__badge">{opt.badge}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
