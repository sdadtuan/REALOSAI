import {
  bodyContainsPiiFields,
  computeProfileCompleteness,
  maskCccd,
  maskIdentityForApi,
} from './hr-employee-file.util';

describe('hr-employee-file.util', () => {
  it('maskCccd shows last 3 digits', () => {
    expect(maskCccd('001234567890')).toBe('•••• 890');
    expect(maskCccd('')).toBe('');
  });

  it('maskIdentityForApi masks PII when cap missing', () => {
    const row = {
      staff_id: 1,
      legal_name: 'Nguyễn A',
      dob: '1990-01-01',
      gender: 'M',
      nationality: 'VN',
      cccd: '001234567890',
      cccd_issued_on: null,
      cccd_issued_by: '',
      tax_code: '0123456789',
      bank_name: 'VCB',
      bank_account: '1234567890',
      bank_holder: 'Nguyễn A',
      timeclock_pin: '',
      created_at: '',
      updated_at: '',
    };
    const masked = maskIdentityForApi(row, false);
    expect(masked.cccd).toBe('•••• 890');
    expect(masked.tax_code).toBe('•••• 6789');
    expect(masked.pii_masked).toBe(true);
    expect(masked.legal_name).toBe('Nguyễn A');
  });

  it('computeProfileCompleteness counts address pair', () => {
    const pct = computeProfileCompleteness(
      {
        staff_id: 1,
        legal_name: 'A',
        dob: '1990-01-01',
        gender: '',
        nationality: 'VN',
        cccd: '001234567890',
        cccd_issued_on: null,
        cccd_issued_by: '',
        tax_code: '',
        bank_name: '',
        bank_account: '',
        bank_holder: '',
        timeclock_pin: '',
        created_at: '',
        updated_at: '',
      },
      [
        { kind: 'permanent', line1: '12 ABC' },
        { kind: 'temporary', line1: '', same_as_permanent: true },
      ],
    );
    expect(pct).toBe(100);
  });

  it('bodyContainsPiiFields detects bank fields', () => {
    expect(bodyContainsPiiFields({ bank_account: '1' })).toBe(true);
    expect(bodyContainsPiiFields({ legal_name: 'A' })).toBe(false);
  });
});
