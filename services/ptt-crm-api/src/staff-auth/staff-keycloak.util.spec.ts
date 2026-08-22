import {
  normalizeKeycloakGroups,
  parseStaffKeycloakJwt,
  positionRequiresMfa,
  staffEmailFromClaims,
  staffMfaSatisfied,
} from './staff-keycloak.util';

describe('staff-keycloak.util', () => {
  it('parses JWT payload without verification', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'kc-sub-1',
        email: 'Admin@PTTADS.VN',
        groups: ['/grp-gdkd', 'grp-am'],
        acr: 'mfa',
      }),
    ).toString('base64url');
    const token = `${header}.${payload}.sig`;
    const parsed = parseStaffKeycloakJwt(token);
    expect(parsed?.payload.sub).toBe('kc-sub-1');
    expect(staffEmailFromClaims(parsed!.payload)).toBe('admin@pttads.vn');
    expect(normalizeKeycloakGroups(parsed!.payload.groups)).toEqual(['grp-gdkd', 'grp-am']);
  });

  it('detects MFA satisfied via acr or amr', () => {
    expect(staffMfaSatisfied({ sub: '1', acr: 'mfa' })).toBe(true);
    expect(staffMfaSatisfied({ sub: '1', amr: ['pwd', 'otp'] })).toBe(true);
    expect(staffMfaSatisfied({ sub: '1', acr: '0' })).toBe(false);
  });

  it('matches MFA-required position codes case-insensitively', () => {
    expect(positionRequiresMfa('SUPER-ADMIN', ['super-admin', 'gdkd'])).toBe(true);
    expect(positionRequiresMfa('KD-01', ['gdkd'])).toBe(false);
  });
});
