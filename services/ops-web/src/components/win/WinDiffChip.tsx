type WinDiffChipProps = {
  added: number;
  removed: number;
};

export function WinDiffChip({ added, removed }: WinDiffChipProps) {
  if (added === 0 && removed === 0) return null;
  return (
    <span className="win-diff-chip" role="status">
      {added > 0 ? <span className="win-diff-chip__add">+{added}</span> : null}
      {removed > 0 ? <span className="win-diff-chip__remove">−{removed}</span> : null}
    </span>
  );
}
