import { WinSodBanner } from '@/components/win';
import { detectSodViolations } from '@/lib/rbac/sod-rules';

type JobFunctionOption = {
  code: string;
  label: string;
};

type Props = {
  options: JobFunctionOption[];
  value: string[];
  max?: number;
  disabled?: boolean;
  onChange: (next: string[]) => void;
};

export function JobFunctionPicker({ options, value, max = 3, disabled, onChange }: Props) {
  const violations = detectSodViolations(value);

  function toggle(code: string) {
    if (disabled) return;
    const set = new Set(value);
    if (set.has(code)) {
      set.delete(code);
    } else if (set.size < max) {
      set.add(code);
    }
    onChange([...set].sort());
  }

  return (
    <div className="job-function-picker stack-gap">
      <p className="muted" style={{ margin: 0 }}>
        Job functions (tối đa {max}): {value.length}/{max}
      </p>
      <div className="job-function-picker__grid">
        {options.map((opt) => {
          const checked = value.includes(opt.code);
          const atMax = !checked && value.length >= max;
          return (
            <label
              key={opt.code}
              className={`job-function-picker__item${checked ? ' is-checked' : ''}${atMax ? ' is-disabled' : ''}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled || atMax}
                onChange={() => toggle(opt.code)}
              />
              <span>
                <strong>{opt.code}</strong> — {opt.label}
              </span>
            </label>
          );
        })}
      </div>
      {violations.map((v) => (
        <WinSodBanner key={v.id} sodId={v.id} message={v.message} />
      ))}
    </div>
  );
}
