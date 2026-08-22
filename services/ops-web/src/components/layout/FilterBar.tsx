import type { FormEvent, ReactNode } from 'react';

type FilterBarProps = {
  children: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  className?: string;
};

export function FilterBar({ children, onSubmit, className }: FilterBarProps) {
  if (onSubmit) {
    return (
      <form className={`filter-bar${className ? ` ${className}` : ''}`} onSubmit={onSubmit}>
        {children}
      </form>
    );
  }
  return <div className={`filter-bar${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function FilterBarSearch({
  value,
  onChange,
  placeholder = 'Tìm kiếm…',
  name = 'q',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
}) {
  return (
    <input
      type="search"
      className="filter-bar__search"
      name={name}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FilterBarActions({ children }: { children: ReactNode }) {
  return <div className="filter-bar__actions">{children}</div>;
}
