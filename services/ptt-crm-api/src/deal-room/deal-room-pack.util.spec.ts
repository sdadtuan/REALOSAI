import {
  buildDealRoomPackPdf,
  dealPackExportFilename,
  formatVnd,
  resolvePackTimeline,
  buildDealRoomPackSections,
  type DealRoomPackInput,
} from './deal-room-pack.util';

describe('deal-room-pack.util', () => {
  const baseInput: DealRoomPackInput = {
    lead_id: 900000910,
    lead_name: '[WORKSHOP B1] ABC Logistics B2B',
    service_slug: 'meta-lead-gen',
    export_date: '2026-08-11T10:00:00.000Z',
    owner_name: 'AM Demo',
    solution_name: 'Solution Demo',
    marketing_plan: {
      name: 'KH MKT sơ bộ — Lead #900000910',
      north_star: 'Tăng lead B2B chất lượng',
      objectives: 'CPL ≤ 200k trong 90 ngày',
      strategy_framework: {
        market_message: 'Đối tác logistics tin cậy',
        media_reach: 'Meta Lead Ads + retarget',
        conversion_strategy: 'Form + call SLA 15p',
      },
    },
    quote_tiers: [
      {
        tier: 'basic',
        tier_label: 'Cơ bản',
        lines: [{ dv_code: 'DV04', dv_name: 'Meta Lead Gen', package_tier: 'basic', final_price_vnd: 10000000 }],
        total_vnd: 10000000,
      },
      {
        tier: 'standard',
        tier_label: 'Tiêu chuẩn',
        lines: [{ dv_code: 'DV04', dv_name: 'Meta Lead Gen', package_tier: 'standard', final_price_vnd: 20000000 }],
        total_vnd: 20000000,
      },
      {
        tier: 'premium',
        tier_label: 'Chuyên sâu',
        lines: [{ dv_code: 'DV04', dv_name: 'Meta Lead Gen', package_tier: 'premium', final_price_vnd: 35000000 }],
        total_vnd: 35000000,
      },
    ],
    proposal_id: 42,
    include_timeline: true,
    show_ai_disclaimer: true,
  };

  it('formatVnd formats Vietnamese locale', () => {
    expect(formatVnd(10000000)).toContain('10');
    expect(formatVnd(0)).toBe('—');
  });

  it('dealPackExportFilename uses lead id and date', () => {
    expect(dealPackExportFilename(900000910, '2026-08-11')).toBe('PTT-DealPack-900000910-20260811.pdf');
  });

  it('resolvePackTimeline prefers service slug config', () => {
    const rows = resolvePackTimeline('meta-lead-gen');
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]?.phase).toBeTruthy();
  });

  it('buildDealRoomPackSections includes L1, quote, timeline, disclaimer', () => {
    const sections = buildDealRoomPackSections(baseInput);
    const titles = sections.map((s) => s.title);
    expect(titles).toContain('Bìa');
    expect(titles).toContain('L1 — KH Marketing sơ bộ');
    expect(titles).toContain('Báo giá 3 gói');
    expect(titles).toContain('Timeline 90 ngày');
    const legal = sections.find((s) => s.title.includes('Pháp lý'));
    expect(legal?.lines.some((l) => l.includes('AI'))).toBe(true);
  });

  it('buildDealRoomPackPdf returns valid PDF header', () => {
    const buf = buildDealRoomPackPdf(baseInput);
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(500);
  });
});
