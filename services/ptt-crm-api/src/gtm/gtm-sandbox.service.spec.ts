import { ConflictException, NotFoundException } from '@nestjs/common';
import { GtmSandboxService } from './gtm-sandbox.service';
import { ConsoleGtmSandboxMailer } from './gtm-sandbox.mailer';
import { InMemoryGtmSandboxStore } from './gtm-sandbox.store';
import { GtmRepository } from './gtm.repository';

function demoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    created_at: '2026-08-15T09:00:00.000Z',
    updated_at: '2026-08-15T09:00:00.000Z',
    locale: 'vi',
    full_name: 'Nguyen An',
    email: 'an@agency.vn',
    phone: '0901234567',
    company: 'An Agency',
    industry: 'agency',
    sku_interest: 'agy',
    company_size: null,
    message: null,
    landing_path: '/vi/giai-phap/agency',
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    status: 'demo_booked',
    status_note: null,
    owner_user_id: 'u1',
    lead_id: '42',
    sandbox_expires_at: null,
    sandbox_user_id: null,
    ip_hash: 'abc',
    ...overrides,
  };
}

describe('GtmSandboxService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-15T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function svc(repo: Partial<GtmRepository>, store = new InMemoryGtmSandboxStore()) {
    return new GtmSandboxService(
      repo as GtmRepository,
      new ConsoleGtmSandboxMailer(),
      store,
    );
  }

  it('409 when status is new', async () => {
    const repo = { getById: jest.fn().mockResolvedValue(demoRow({ status: 'new' })) };
    await expect(svc(repo).grantSandbox('id')).rejects.toThrow(ConflictException);
  });

  it('grants sandbox for demo_booked', async () => {
    const repo = {
      getById: jest.fn().mockResolvedValue(demoRow()),
      patch: jest.fn().mockResolvedValue(
        demoRow({
          status: 'sandbox_granted',
          sandbox_user_id: 'demo_550e8400',
          sandbox_expires_at: '2026-08-29T10:00:00.000Z',
        }),
      ),
    };
    const store = new InMemoryGtmSandboxStore();
    const out = await svc(repo, store).grantSandbox('550e8400-e29b-41d4-a716-446655440000');
    expect(out.status).toBe('sandbox_granted');
    expect(store.get('demo_550e8400')?.tenant).toBe('sandbox_agency');
  });

  it('returns idempotent row when sandbox still active', async () => {
    const repo = {
      getById: jest.fn().mockResolvedValue(
        demoRow({
          status: 'sandbox_granted',
          sandbox_expires_at: '2026-08-20T10:00:00.000Z',
          sandbox_user_id: 'demo_550e8400',
        }),
      ),
    };
    const out = await svc(repo).grantSandbox('id');
    expect(out.status).toBe('sandbox_granted');
    expect(repo.getById).toHaveBeenCalledTimes(1);
  });

  it('keeps demo_booked when email bounces', async () => {
    const repo = {
      getById: jest.fn().mockResolvedValue(demoRow({ email: 'bounce@test.vn' })),
      patch: jest.fn().mockResolvedValue(demoRow({ status_note: 'sandbox_email_failed' })),
    };
    const store = new InMemoryGtmSandboxStore();
    const out = await svc(repo, store).grantSandbox('id');
    expect(out.status).toBe('demo_booked');
    expect(out.status_note).toBe('sandbox_email_failed');
    expect(store.isDisabled('demo_550e8400')).toBe(true);
  });

  it('404 when demo missing', async () => {
    const repo = { getById: jest.fn().mockResolvedValue(null) };
    await expect(svc(repo).grantSandbox('missing')).rejects.toThrow(NotFoundException);
  });
});
