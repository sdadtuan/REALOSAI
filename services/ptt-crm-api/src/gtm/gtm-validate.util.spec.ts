import { isHoneypot, validatePublicDemoBody } from './gtm-validate.util';

describe('gtm-validate.util', () => {
  describe('validatePublicDemoBody', () => {
    it('rejects short name and missing consent', () => {
      const r = validatePublicDemoBody({
        full_name: 'A',
        email: 'bad',
        phone: '123',
        company: 'X',
        industry: 'agency',
        sku_interest: 'agy',
        consent_privacy: false,
        locale: 'vi',
        landing_path: '/vi',
        website: '',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.field_errors.full_name).toBeTruthy();
        expect(r.field_errors.email).toBeTruthy();
        expect(r.field_errors.phone).toBeTruthy();
        expect(r.field_errors.consent_privacy).toBeTruthy();
      }
    });

    it('accepts VN phone and empty honeypot field', () => {
      const r = validatePublicDemoBody({
        full_name: 'Nguyen An',
        email: 'an@agency.vn',
        phone: '0901234567',
        company: 'An Agency',
        industry: 'agency',
        sku_interest: 'agy',
        consent_privacy: true,
        locale: 'vi',
        landing_path: '/vi/giai-phap/agency',
        website: '',
      });
      expect(r.ok).toBe(true);
    });

    it('EN demo accepts market_country th', () => {
      const r = validatePublicDemoBody({
        full_name: 'Jane Doe',
        email: 'jane@agency.sg',
        phone: '+6591234567',
        company: 'Agency SG',
        industry: 'agency',
        sku_interest: 'agy',
        consent_privacy: true,
        locale: 'en',
        landing_path: '/en/markets/sg',
        website: '',
        market_country: 'th',
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.market_country).toBe('th');
    });

    it('rejects invalid market_country', () => {
      const r = validatePublicDemoBody({
        full_name: 'Jane Doe',
        email: 'jane@agency.sg',
        phone: '+6591234567',
        company: 'Agency SG',
        industry: 'agency',
        sku_interest: 'agy',
        consent_privacy: true,
        locale: 'en',
        landing_path: '/en/markets/sg',
        website: '',
        market_country: 'vn',
      });
      expect(r.ok).toBe(false);
    });
  });

  describe('isHoneypot', () => {
    it('returns true when website is non-empty', () => {
      expect(isHoneypot({ website: 'https://spam.example' })).toBe(true);
      expect(isHoneypot({ website: ' ' })).toBe(false);
    });

    it('returns false when website is empty or omitted', () => {
      expect(isHoneypot({ website: '' })).toBe(false);
      expect(isHoneypot({})).toBe(false);
    });
  });
});
