'use client';

type Props = {
  text: string;
  label?: string;
  onCopied?: () => void;
};

export function CopyScriptButton({ text, label = 'Copy script', onCopied }: Props) {
  async function onCopy() {
    try {
      if (onCopied) {
        await onCopied();
        return;
      }
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onCopy()}>
      {label}
    </button>
  );
}
