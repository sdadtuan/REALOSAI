import {
  normalizeCareContactType,
  normalizeCareReportStatus,
} from './care-status.util';

describe('care-status.util', () => {
  it('defaults empty care_status to Liên hệ OK', () => {
    expect(normalizeCareReportStatus(undefined)).toBe('da_lien_he_thanh_cong');
  });

  it('accepts B2 negative statuses', () => {
    expect(normalizeCareReportStatus('khong_nghe_may')).toBe('khong_nghe_may');
    expect(normalizeCareReportStatus('da_phan_loai')).toBe('da_phan_loai');
  });

  it('rejects unknown care_status', () => {
    expect(normalizeCareReportStatus('invalid_status')).toBeNull();
  });

  it('maps phone contact type to goi_dien', () => {
    expect(normalizeCareContactType('phone')).toBe('goi_dien');
    expect(normalizeCareContactType('zalo')).toBe('zalo');
  });
});
