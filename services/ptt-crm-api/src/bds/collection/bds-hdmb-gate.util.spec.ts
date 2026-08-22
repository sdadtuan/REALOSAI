import { BadRequestException } from '@nestjs/common';
import { assertHdmbLegalGate, assertHdmbPaidPct } from './bds-hdmb-gate.util';

describe('bds-hdmb-gate.util', () => {
  const now = new Date('2026-08-22T12:00:00Z');

  it('BDS-31 missing so_xd → legal_gate_hdmb', () => {
    try {
      assertHdmbLegalGate({
        docs: [{ doc_type: 'mau_hdmb', status: 'valid' }],
        now,
      });
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'legal_gate_hdmb' });
    }
  });

  it('pass when so_xd + bao_lanh + mau_hdmb valid', () => {
    expect(() =>
      assertHdmbLegalGate({
        docs: [
          { doc_type: 'so_xd_du_dieu_kien_ban', status: 'valid' },
          { doc_type: 'bao_lanh_nh', status: 'valid' },
          { doc_type: 'mau_hdmb', status: 'valid' },
        ],
        now,
      }),
    ).not.toThrow();
  });

  it('waive bao_lanh requires file', () => {
    expect(() =>
      assertHdmbLegalGate({
        docs: [
          { doc_type: 'so_xd_du_dieu_kien_ban', status: 'valid' },
          { doc_type: 'mau_hdmb', status: 'valid' },
        ],
        now,
        buyerWaiveGuarantee: true,
        waiveFileId: 'file-1',
      }),
    ).not.toThrow();
  });

  it('BDS-32 paid pct below min', () => {
    try {
      assertHdmbPaidPct(29.9, 30);
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'paid_pct' });
    }
    expect(() => assertHdmbPaidPct(30, 30)).not.toThrow();
  });
});
