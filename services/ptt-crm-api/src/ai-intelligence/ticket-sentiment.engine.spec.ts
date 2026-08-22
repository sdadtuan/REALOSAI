import { computeTicketSentiment } from './ticket-sentiment.engine';

describe('ticket-sentiment.engine', () => {
  it('flags complaint ticket as negative', () => {
    const out = computeTicketSentiment({
      ticket_id: 1,
      title: 'Phàn nàn dịch vụ quá tệ',
      description: 'Không hài lòng, yêu cầu hoàn tiền',
      ticket_type: 'phan_nan',
      priority: 'cao',
    });
    expect(out.label).toBe('negative');
    expect(out.score).toBeLessThanOrEqual(35);
  });

  it('flags thank-you ticket as positive', () => {
    const out = computeTicketSentiment({
      ticket_id: 2,
      title: 'Cảm ơn team hỗ trợ',
      description: 'Rất hài lòng với dịch vụ',
      ticket_type: 'phan_anh',
      priority: 'binh_thuong',
    });
    expect(out.label).toBe('positive');
    expect(out.score).toBeGreaterThanOrEqual(65);
  });

  it('defaults neutral when no strong signals', () => {
    const out = computeTicketSentiment({
      ticket_id: 3,
      title: 'Hỏi thông tin gói dịch vụ',
      description: 'Cần biết thêm chi tiết triển khai',
      ticket_type: 'yeu_cau_dich_vu',
      priority: 'binh_thuong',
    });
    expect(out.label).toBe('neutral');
  });
});
