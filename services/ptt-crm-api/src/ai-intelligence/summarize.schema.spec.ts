import { validateSummarizeOutput, parseExtracted } from './summarize.schema';

describe('summarize.schema', () => {
  it('validates activity output', () => {
    const out = validateSummarizeOutput(
      {
        summary: 'Khách hỏi giá gói SEO, hẹn gọi lại chiều nay.',
        extracted: {
          intent: 'Báo giá',
          objections: ['Giá cao'],
          next_action: 'Gọi lại 15h',
        },
        confidence: 0.82,
      },
      'activity',
    );
    expect(out.summary).toContain('Khách');
    expect(out.extracted.intent).toBe('Báo giá');
    expect(out.extracted.objections).toEqual(['Giá cao']);
  });

  it('builds bullets for lead_brief when missing', () => {
    const out = validateSummarizeOutput(
      {
        summary: '- Lead mới từ Meta\n- Cần gọi xác nhận',
        extracted: { source: 'meta' },
      },
      'lead_brief',
    );
    expect(out.bullets.length).toBeGreaterThan(0);
    expect(out.bullets.length).toBeLessThanOrEqual(5);
  });

  it('parses extracted defaults', () => {
    expect(parseExtracted(null).objections).toEqual([]);
  });
});
