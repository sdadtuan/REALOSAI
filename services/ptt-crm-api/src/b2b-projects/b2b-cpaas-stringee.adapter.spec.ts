import { mapStringeeEvent, resolveSessionIdFromProviderRef } from './b2b-cpaas-stringee.util';

describe('mapStringeeEvent', () => {
  it('maps stringee answered to session answered', () => {
    expect(mapStringeeEvent('answered')).toBe('answered');
  });

  it('maps ringing and ended', () => {
    expect(mapStringeeEvent('ringing')).toBe('ringing');
    expect(mapStringeeEvent('ended')).toBe('ended');
  });
});

describe('resolveSessionIdFromProviderRef', () => {
  it('resolves mock and stringee pending refs', () => {
    expect(resolveSessionIdFromProviderRef('mock-abc')).toBe('abc');
    expect(resolveSessionIdFromProviderRef('stringee-pending-abc')).toBe('abc');
  });
});
