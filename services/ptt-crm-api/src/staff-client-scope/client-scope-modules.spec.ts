import { ForbiddenException } from '@nestjs/common';
import { assertClientInScope } from './staff-client-scope.util';

describe('client-scope-modules', () => {
  const allowed = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];

  it('allows client in scope', () => {
    expect(assertClientInScope(allowed[0], allowed)).toBe(true);
  });

  it('denies client outside scope', () => {
    expect(assertClientInScope('33333333-3333-4333-8333-333333333333', allowed)).toBe(false);
  });

  it('maps to 403 shape used by controllers', () => {
    const clientId = '33333333-3333-4333-8333-333333333333';
    expect(() => {
      if (!assertClientInScope(clientId, allowed)) {
        throw new ForbiddenException({ error: 'client_scope_denied', client_id: clientId });
      }
    }).toThrow(ForbiddenException);
  });
});
