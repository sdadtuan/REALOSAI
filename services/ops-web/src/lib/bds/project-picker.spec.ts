import { afterEach, describe, expect, it } from 'vitest';
import { readBdsProjectId, writeBdsProjectId } from './project-picker';

const store = new Map<string, string>();
let pathAndSearch = '/';

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem(key: string) {
          return store.has(key) ? store.get(key)! : null;
        },
        setItem(key: string, value: string) {
          store.set(key, value);
        },
        clear() {
          store.clear();
        },
      },
      get location() {
        const url = new URL(pathAndSearch, 'http://localhost');
        return { search: url.search, pathname: url.pathname, href: url.href };
      },
      history: {
        replaceState(_state: unknown, _title: string, url: string) {
          pathAndSearch = url;
        },
      },
    },
  });
}

describe('readBdsProjectId', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('prefers ?project= over sessionStorage', () => {
    window.sessionStorage.setItem('bds-project-id', '7');
    window.history.replaceState({}, '', '/crm/bds/holds?project=9001');
    expect(readBdsProjectId()).toBe(9001);
  });

  it('falls back to sessionStorage', () => {
    writeBdsProjectId(42);
    expect(readBdsProjectId()).toBe(42);
  });
});
