type WinFilterChip = {
  id: string;
  label: string;
};

type WinFilterChipsProps = {
  chips: WinFilterChip[];
  onRemove: (chipId: string) => void;
  onClearAll?: () => void;
};

export function WinFilterChips({ chips, onRemove, onClearAll }: WinFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="win-filter-chips" role="list" aria-label="Bộ lọc đang áp dụng">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className="win-filter-chip"
          role="listitem"
          onClick={() => onRemove(chip.id)}
          aria-label={`Bỏ lọc ${chip.label}`}
        >
          <span>{chip.label}</span>
          <span className="win-filter-chip__x" aria-hidden="true">
            ×
          </span>
        </button>
      ))}
      {onClearAll ? (
        <button type="button" className="win-filter-chip win-filter-chip--clear" onClick={onClearAll}>
          Xóa tất cả
        </button>
      ) : null}
    </div>
  );
}
