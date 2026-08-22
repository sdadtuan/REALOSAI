import { parseMentionEmails } from './staff-mention.util';

describe('parseMentionEmails', () => {
  it('extracts unique @email mentions', () => {
    const emails = parseMentionEmails('Ping @alice@ptt.vn and @bob@ptt.vn @alice@ptt.vn');
    expect(emails).toEqual(['alice@ptt.vn', 'bob@ptt.vn']);
  });

  it('returns empty for plain text', () => {
    expect(parseMentionEmails('no mentions here')).toEqual([]);
  });
});
