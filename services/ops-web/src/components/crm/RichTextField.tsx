'use client';

import { useCallback, useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
  ariaLabel?: string;
}

function normalizeHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed || trimmed === '<br>' || trimmed === '<div><br></div>') return '';
  return html;
}

export function RichTextField({
  value,
  onChange,
  disabled = false,
  placeholder = 'Nhập nội dung…',
  minHeight = '12rem',
  ariaLabel,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastExternal = useRef(value);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastExternal.current) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
    lastExternal.current = value;
  }, [value]);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const next = normalizeHtml(el.innerHTML);
    lastExternal.current = next;
    onChange(next);
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  };

  return (
    <div className={`rich-text-field${disabled ? ' rich-text-field--disabled' : ''}`}>
      <div className="rich-text-field__toolbar" role="toolbar" aria-label="Định dạng văn bản">
        <button type="button" className="rich-text-field__btn" disabled={disabled} onClick={() => exec('bold')} title="In đậm">
          B
        </button>
        <button type="button" className="rich-text-field__btn" disabled={disabled} onClick={() => exec('italic')} title="In nghiêng">
          I
        </button>
        <button type="button" className="rich-text-field__btn" disabled={disabled} onClick={() => exec('insertUnorderedList')} title="Danh sách gạch đầu dòng">
          •
        </button>
        <button type="button" className="rich-text-field__btn" disabled={disabled} onClick={() => exec('insertOrderedList')} title="Danh sách đánh số">
          1.
        </button>
        <button type="button" className="rich-text-field__btn" disabled={disabled} onClick={() => exec('formatBlock', 'h3')} title="Tiêu đề">
          H
        </button>
      </div>
      <div
        ref={editorRef}
        className="rich-text-field__editor"
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? placeholder}
        data-placeholder={placeholder}
        style={{ minHeight }}
        onInput={emitChange}
        onBlur={emitChange}
      />
    </div>
  );
}
