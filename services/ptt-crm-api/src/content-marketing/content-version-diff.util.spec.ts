import { diffMarkdownLines } from './content-version-diff.util';

describe('diffMarkdownLines', () => {
  it('returns same lines when text matches', () => {
    const out = diffMarkdownLines('hello\nworld', 'hello\nworld');
    expect(out.lines.every((l) => l.type === 'same')).toBe(true);
    expect(out.lines.map((l) => l.text)).toEqual(['hello', 'world']);
  });

  it('marks added and deleted lines', () => {
    const out = diffMarkdownLines('a\nb', 'a\nc');
    expect(out.lines).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'c' },
    ]);
  });

  it('handles empty before', () => {
    const out = diffMarkdownLines('', 'new line');
    expect(out.lines).toEqual([{ type: 'add', text: 'new line' }]);
  });
});
