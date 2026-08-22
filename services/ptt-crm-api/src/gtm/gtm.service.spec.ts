import { ConflictException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { GtmService } from './gtm.service';

function cfg(): AppConfigService {
  return {
    gtmIpSalt: 'test-salt',
    gtmSalesUserIds: ['u1', 'u2'],
    gtmCorsOrigins: ['http://localhost:3300'],
  } as AppConfigService;
}

function validBody() {
  return {
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
  };
}

describe('GtmService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-15T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('honeypot does not insert', async () => {
    const repo = { insert: jest.fn(), findLeadIdByEmailSince: jest.fn(), lastOwnerId: jest.fn() };
    const leads = { createLead: jest.fn() };
    const svc = new GtmService(repo as never, leads as never, cfg());
    await expect(svc.createPublic({ website: 'http://spam', consent_privacy: true }, '1.1.1.1')).resolves.toBe(
      'honeypot',
    );
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('dedup 7 days reuses lead_id', async () => {
    const repo = {
      insert: jest.fn().mockResolvedValue({ id: 'r2' }),
      findLeadIdByEmailSince: jest.fn().mockResolvedValue('99'),
      lastOwnerId: jest.fn().mockResolvedValue(null),
    };
    const leads = { createLead: jest.fn() };
    const svc = new GtmService(repo as never, leads as never, cfg());
    const out = await svc.createPublic(validBody(), '1.1.1.1');
    expect(out).toEqual({ id: 'r2', lead_id: '99', deduped: true });
    expect(leads.createLead).not.toHaveBeenCalled();
  });

  it('creates lead when email is not deduped', async () => {
    const repo = {
      insert: jest.fn().mockResolvedValue({ id: 'r1' }),
      findLeadIdByEmailSince: jest.fn().mockResolvedValue(null),
      lastOwnerId: jest.fn().mockResolvedValue('u1'),
    };
    const leads = {
      createLead: jest.fn().mockResolvedValue({ id: 42 }),
    };
    const svc = new GtmService(repo as never, leads as never, cfg());
    const out = await svc.createPublic(validBody(), '1.1.1.1');
    expect(out).toEqual({ id: 'r1', lead_id: '42', deduped: false });
    expect(leads.createLead).toHaveBeenCalledWith({
      full_name: 'Nguyen An',
      email: 'an@agency.vn',
      phone: '0901234567',
      source: 'pttcrm_web',
      channel: 'web',
      lead_flow_kind: 'b2b_prospect',
      meta: { company: 'An Agency' },
    });
  });

  it('rate limits after 10 requests per ip hash within an hour', async () => {
    const repo = {
      insert: jest.fn().mockResolvedValue({ id: 'r1' }),
      findLeadIdByEmailSince: jest.fn().mockResolvedValue(null),
      lastOwnerId: jest.fn().mockResolvedValue(null),
    };
    const leads = { createLead: jest.fn().mockResolvedValue({ id: 1 }) };
    const svc = new GtmService(repo as never, leads as never, cfg());

    for (let i = 0; i < 10; i += 1) {
      await expect(svc.createPublic(validBody(), '1.1.1.1')).resolves.toEqual({
        id: 'r1',
        lead_id: '1',
        deduped: false,
      });
    }
    await expect(svc.createPublic(validBody(), '1.1.1.1')).resolves.toBe('rate_limited');
  });

  it('rejects invalid transition with conflict', async () => {
    const repo = {
      getById: jest.fn().mockResolvedValue({
        id: 'r1',
        status: 'new',
        status_note: null,
        created_at: '2026-08-15T09:00:00.000Z',
      }),
      patch: jest.fn(),
    };
    const svc = new GtmService(repo as never, {} as never, cfg());
    await expect(svc.patchDemoRequest('r1', { status: 'won' })).rejects.toThrow(ConflictException);
  });

  it('requires status_note when moving to qualified', async () => {
    const repo = {
      getById: jest.fn().mockResolvedValue({
        id: 'r1',
        status: 'new',
        status_note: null,
        created_at: '2026-08-15T09:00:00.000Z',
      }),
      patch: jest.fn(),
    };
    const svc = new GtmService(repo as never, {} as never, cfg());
    await expect(
      svc.patchDemoRequest('r1', { status: 'qualified', status_note: 'short' }),
    ).rejects.toThrow(ConflictException);
  });
});
