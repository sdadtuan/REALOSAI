export type Industry = 'bds' | 'agency' | 'fnb' | 'education' | 'pharma' | 'other';
export type SkuInterest = 'mkt' | 'ind' | 'agy';
export type CompanySize = '1-10' | '11-30' | '31-80' | '81+';
export type PublicDemoLocale = 'vi' | 'en';
export type AseanMarket = 'th' | 'id' | 'ph' | 'sg';

const ASEAN_MARKETS = new Set<AseanMarket>(['th', 'id', 'ph', 'sg']);

export type PublicDemoBody = {
  full_name: string;
  email: string;
  phone: string;
  company: string;
  industry: Industry;
  sku_interest: SkuInterest;
  company_size?: CompanySize;
  message?: string;
  consent_privacy: true;
  locale: PublicDemoLocale;
  landing_path: string;
  website?: string;
  market_country?: AseanMarket;
};

const INDUSTRIES = new Set<Industry>(['bds', 'agency', 'fnb', 'education', 'pharma', 'other']);
const SKUS = new Set<SkuInterest>(['mkt', 'ind', 'agy']);
const COMPANY_SIZES = new Set<CompanySize>(['1-10', '11-30', '31-80', '81+']);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?[1-9]\d{7,14}|0\d{9})$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validatePublicDemoBody(
  body: unknown,
): { ok: true; value: PublicDemoBody } | { ok: false; field_errors: Record<string, string> } {
  const field_errors: Record<string, string> = {};
  if (!isRecord(body)) {
    return { ok: false, field_errors: { form: 'invalid_payload' } };
  }

  const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  if (full_name.length < 2) field_errors.full_name = 'too_short';

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(email)) field_errors.email = 'invalid';

  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!PHONE_RE.test(phone)) field_errors.phone = 'invalid';

  const company = typeof body.company === 'string' ? body.company.trim() : '';
  if (company.length < 2) field_errors.company = 'too_short';

  const industry = body.industry;
  if (typeof industry !== 'string' || !INDUSTRIES.has(industry as Industry)) {
    field_errors.industry = 'invalid';
  }

  const sku_interest = body.sku_interest;
  if (typeof sku_interest !== 'string' || !SKUS.has(sku_interest as SkuInterest)) {
    field_errors.sku_interest = 'invalid';
  }

  const locale = body.locale;
  if (locale !== 'vi' && locale !== 'en') field_errors.locale = 'invalid';

  const landing_path = typeof body.landing_path === 'string' ? body.landing_path : '';
  if (!landing_path.startsWith('/')) field_errors.landing_path = 'invalid';

  if (body.consent_privacy !== true) field_errors.consent_privacy = 'required';

  const message = typeof body.message === 'string' ? body.message : undefined;
  if (message !== undefined && message.length > 1000) field_errors.message = 'too_long';

  const company_size = body.company_size;
  if (
    company_size !== undefined &&
    company_size !== null &&
    company_size !== '' &&
    (typeof company_size !== 'string' || !COMPANY_SIZES.has(company_size as CompanySize))
  ) {
    field_errors.company_size = 'invalid';
  }

  const rawMarket = body.market_country;
  let market_country: AseanMarket | undefined;
  if (rawMarket !== undefined && rawMarket !== null && rawMarket !== '') {
    if (locale !== 'en') {
      field_errors.market_country = 'invalid';
    } else if (typeof rawMarket !== 'string' || !ASEAN_MARKETS.has(rawMarket as AseanMarket)) {
      field_errors.market_country = 'invalid';
    } else {
      market_country = rawMarket as AseanMarket;
    }
  }

  if (Object.keys(field_errors).length > 0) {
    return { ok: false, field_errors };
  }

  const value: PublicDemoBody = {
    full_name,
    email,
    phone,
    company,
    industry: industry as Industry,
    sku_interest: sku_interest as SkuInterest,
    consent_privacy: true,
    locale: locale as PublicDemoLocale,
    landing_path,
    website: typeof body.website === 'string' ? body.website : undefined,
  };

  if (market_country) value.market_country = market_country;

  if (company_size && typeof company_size === 'string') {
    value.company_size = company_size as CompanySize;
  }
  if (message) value.message = message;

  return { ok: true, value };
}

export function isHoneypot(body: { website?: string }): boolean {
  return typeof body.website === 'string' && body.website.trim().length > 0;
}
