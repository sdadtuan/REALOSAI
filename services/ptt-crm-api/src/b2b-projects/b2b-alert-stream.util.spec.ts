import { hashB2bAlertInbox } from './b2b-alert-stream.util';

describe('hashB2bAlertInbox', () => {
  it('changes hash when new hot alert arrives', () => {
    const a = hashB2bAlertInbox([{ id: '1', severity: 'hot' }]);
    const b = hashB2bAlertInbox([
      { id: '1', severity: 'hot' },
      { id: '2', severity: 'hot' },
    ]);
    expect(a).not.toBe(b);
  });
});
