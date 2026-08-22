import { resolveConversationProject, parseZaloConversationEvents } from './b2b-conversations.util';

describe('resolveConversationProject', () => {
  const catalog = {
    forms: [],
    pages: [],
    accounts: [
      { channel: 'zalo' as const, externalKey: 'OA1', projectId: 'p1', projectSlug: 'seo', active: true },
    ],
  };

  it('maps oa to project', () => {
    expect(resolveConversationProject({ oaId: 'OA1', projectSlug: 'seo', catalog })).toEqual({
      projectId: 'p1',
    });
  });

  it('slug mismatch → không gắn thread', () => {
    expect(resolveConversationProject({ oaId: 'OA1', projectSlug: 'other', catalog })).toEqual({
      attach: false,
      reason: 'slug_mismatch',
    });
  });
});

describe('parseZaloConversationEvents', () => {
  it('parses user_send_text', () => {
    const events = parseZaloConversationEvents({
      event_name: 'user_send_text',
      oa_id: 'OA1',
      user_id: 'U99',
      info: { text: 'Xin chào' },
    });
    expect(events).toEqual([
      expect.objectContaining({
        oaId: 'OA1',
        userId: 'U99',
        body: 'Xin chào',
        direction: 'inbound',
      }),
    ]);
  });
});
