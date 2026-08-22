'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchStaffRoster, type StaffRosterRow } from '@/lib/api';

type MentionComposerProps = {
  token: string | null;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
};

export function MentionComposer({
  token,
  value,
  onChange,
  disabled,
  rows = 3,
  placeholder,
  className = 'lead-input lead-input--area',
}: MentionComposerProps) {
  const [roster, setRoster] = useState<StaffRosterRow[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!token) return;
    void fetchStaffRoster(token)
      .then((out) => setRoster(out.staff ?? []))
      .catch(() => setRoster([]));
  }, [token]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster.slice(0, 8);
    return roster
      .filter(
        (s) =>
          s.email.toLowerCase().includes(q) ||
          s.display_name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, roster]);

  function detectMention(text: string, cursor: number): string | null {
    const before = text.slice(0, cursor);
    const match = before.match(/@([a-zA-Z0-9._%+-]*)$/);
    return match ? match[1] ?? '' : null;
  }

  function insertEmail(email: string) {
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const atIndex = before.lastIndexOf('@');
    if (atIndex < 0) return;
    const next = `${before.slice(0, atIndex)}@${email} ${after}`;
    onChange(next);
    setOpen(false);
    setQuery('');
    requestAnimationFrame(() => {
      el.focus();
      const pos = atIndex + email.length + 2;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="mention-composer">
      <textarea
        ref={textareaRef}
        className={className}
        value={value}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder ?? 'Ghi chú… Gõ @ để nhắc đồng nghiệp (email)'}
        onChange={(e) => {
          onChange(e.target.value);
          const q = detectMention(e.target.value, e.target.selectionStart ?? 0);
          if (q != null) {
            setQuery(q);
            setOpen(true);
          } else {
            setOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && suggestions.length ? (
        <ul className="mention-composer__dropdown" role="listbox">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="mention-composer__option"
                onClick={() => insertEmail(s.email)}
              >
                <strong>{s.display_name}</strong>
                <span>{s.email}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
