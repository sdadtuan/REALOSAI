import {
  assertClientInScope,
  isClientScopeRestricted,
  isSuperAdminPositionCode,
  normalizeClientIds,
} from './staff-client-scope.util';

describe('staff-client-scope.util', () => {
  it('detects super-admin bypass', () => {
    expect(isSuperAdminPositionCode('super-admin')).toBe(true);
    expect(isSuperAdminPositionCode('AM-01')).toBe(false);
  });

  it('restricts only when pilot on and bindings exist', () => {
    expect(isClientScopeRestricted(false, 'AM-01', ['uuid-1'])).toBe(false);
    expect(isClientScopeRestricted(true, 'super-admin', ['uuid-1'])).toBe(false);
    expect(isClientScopeRestricted(true, 'AM-01', [])).toBe(false);
    expect(isClientScopeRestricted(true, 'AM-01', ['uuid-1'])).toBe(true);
  });

  it('checks client membership', () => {
    const allowed = normalizeClientIds(['a', 'b']);
    expect(assertClientInScope('a', allowed)).toBe(true);
    expect(assertClientInScope('c', allowed)).toBe(false);
    expect(assertClientInScope(null, allowed)).toBe(false);
  });
});
