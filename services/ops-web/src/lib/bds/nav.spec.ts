import { describe, expect, it, afterEach } from 'vitest';
import { buildBdsNavSections, hubHomeHref } from './nav';
import type { StoredStaffUser } from '@/lib/auth';

function user(caps: StoredStaffUser['caps']): StoredStaffUser {
  return { id: '1', email: 'u@test.vn', display_name: 'U', position_id: 1, caps };
}

describe('buildBdsNavSections', () => {
  const prev = process.env.NEXT_PUBLIC_PTT_BDS_UI;
  const prevChat = process.env.NEXT_PUBLIC_PTT_STAFF_CHAT;
  const prevTickets = process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS;
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PTT_BDS_UI;
    else process.env.NEXT_PUBLIC_PTT_BDS_UI = prev;
    if (prevChat === undefined) delete process.env.NEXT_PUBLIC_PTT_STAFF_CHAT;
    else process.env.NEXT_PUBLIC_PTT_STAFF_CHAT = prevChat;
    if (prevTickets === undefined) delete process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS;
    else process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS = prevTickets;
  });

  it('UI off → no BĐS section', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '0';
    expect(buildBdsNavSections(user([{ section: 'bds_tenant', action: 'view' }]), 'developer')).toEqual([]);
  });

  it('CĐT shows hub; lead list + board re_buyer', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'bds_buyers', action: 'view' },
        ]),
        'developer',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds')).toBe(true);
    expect(links.some((l) => l.href === '/crm/bds/leads' && l.label === 'Lead khách mua')).toBe(true);
    expect(links.some((l) => l.href === '/crm/cskh-board?flow=re_buyer' && l.label === 'Board CSKH')).toBe(true);
    expect(links.some((l) => l.href.includes('deal-room'))).toBe(false);
  });

  it('broker nav has basket, no hub', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links = buildBdsNavSections(user([{ section: 'bds_baskets', action: 'view' }]), 'broker')[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds/basket')).toBe(true);
    expect(links.some((l) => l.href === '/crm/bds')).toBe(false);
  });

  it('broker never shows Sau bán', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links = buildBdsNavSections(
      user([
        { section: 'bds_baskets', action: 'view' },
        { section: 'bds_aftersales', action: 'view' },
      ]),
      'broker',
    )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds/aftersales')).toBe(false);
  });

  it('CĐT with launches cap shows Ra quân', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'bds_launches', action: 'view' },
        ]),
        'developer',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds/launches' && l.label === 'Ra quân')).toBe(true);
  });

  it('broker never shows Ra quân', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_baskets', action: 'view' },
          { section: 'bds_launches', action: 'view' },
        ]),
        'broker',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds/launches')).toBe(false);
  });

  it('CĐT with aftersales cap shows Sau bán', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'bds_aftersales', action: 'view' },
        ]),
        'developer',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds/aftersales' && l.label === 'Sau bán')).toBe(true);
  });

  it('PTT user without bds_* → empty', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    expect(buildBdsNavSections(user([{ section: 'crm_leads', action: 'view' }]), 'developer')).toEqual([]);
  });

  it('CĐT with staff_chat view shows Chat when FE flag on', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    process.env.NEXT_PUBLIC_PTT_STAFF_CHAT = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'staff_chat', action: 'view' },
        ]),
        'developer',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/chat' && l.label === 'Chat')).toBe(true);
  });

  it('CHAT FE off hides Chat even with cap', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    process.env.NEXT_PUBLIC_PTT_STAFF_CHAT = '0';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'staff_chat', action: 'view' },
        ]),
        'developer',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/chat')).toBe(false);
  });

  it('CĐT with staff_tickets view shows Việc when FE flag on', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'staff_tickets', action: 'view' },
        ]),
        'developer',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/work' && l.label === 'Việc')).toBe(true);
  });

  it('broker never shows Việc even with cap + FE flag', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    process.env.NEXT_PUBLIC_PTT_STAFF_TICKETS = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'staff_tickets', action: 'view' },
        ]),
        'broker',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/work')).toBe(false);
  });

  it('CĐT with policies view shows Giá / CSBH', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'bds_policies', action: 'view' },
        ]),
        'developer',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds/policies' && l.label === 'Giá / CSBH')).toBe(true);
  });

  it('broker never shows policies', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links = buildBdsNavSections(
      user([{ section: 'bds_policies', action: 'view' }]),
      'broker',
    )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds/policies')).toBe(false);
  });

  it('CĐT with finance caps shows Tài chính BĐS hub anchor', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'bds_collections', action: 'view' },
        ]),
        'developer',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds#finance' && l.label === 'Tài chính BĐS')).toBe(true);
  });
});

describe('hubHomeHref', () => {
  it('broker → basket', () => {
    expect(hubHomeHref('broker')).toBe('/crm/bds/basket');
  });

  it('developer → hub', () => {
    expect(hubHomeHref('developer')).toBe('/crm/bds');
  });
});
