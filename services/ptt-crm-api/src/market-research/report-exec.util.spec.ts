import { assertExecEnEditable, normalizeReportExec } from './report-exec.util';

describe('normalizeReportExec', () => {
  it("normalizeReportExec('hello') → { vi: 'hello', en: null, en_status: 'none' }", () => {
    expect(normalizeReportExec('hello')).toEqual({
      vi: 'hello',
      en: null,
      en_status: 'none',
    });
  });
});

describe('assertExecEnEditable', () => {
  it('throws exec_en_locked when en_status is approved', () => {
    expect(() =>
      assertExecEnEditable({ vi: 'xin chào', en: 'hello', en_status: 'approved' }),
    ).toThrow('exec_en_locked');
    try {
      assertExecEnEditable({ vi: 'xin chào', en: 'hello', en_status: 'approved' });
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('exec_en_locked');
    }
  });
});
