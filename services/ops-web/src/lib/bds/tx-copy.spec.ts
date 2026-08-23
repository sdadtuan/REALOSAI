import { describe, expect, it } from 'vitest';
import { parseContractSubmit, parseRequiredRowVersion, txGateCopy } from './tx-copy';

describe('txGateCopy', () => {
  it('maps paid_pct', () => {
    expect(txGateCopy('400 paid_pct')).toBe('Chưa đủ % thu — Công nợ phải ghi phiếu.');
  });

  it('maps legal_gate_hdmb', () => {
    expect(txGateCopy('400 legal_gate_hdmb')).toBe('Chưa đủ điều kiện bán — Pháp chế bật cổng.');
  });
});

describe('parseRequiredRowVersion', () => {
  it('does not default empty or invalid input to 1', () => {
    expect(parseRequiredRowVersion('')).toBeNull();
    expect(parseRequiredRowVersion('   ')).toBeNull();
    expect(parseRequiredRowVersion('abc')).toBeNull();
    expect(parseRequiredRowVersion('-1')).toBeNull();
  });

  it('parses a non-negative integer', () => {
    expect(parseRequiredRowVersion('0')).toBe(0);
    expect(parseRequiredRowVersion('4')).toBe(4);
  });
});

describe('parseContractSubmit', () => {
  it('requires contract_no and row_version', () => {
    expect(parseContractSubmit('', '2')).toBeNull();
    expect(parseContractSubmit('  ', '2')).toBeNull();
    expect(parseContractSubmit('HD-1', '')).toBeNull();
    expect(parseContractSubmit('HD-1', '4')).toEqual({ contract_no: 'HD-1', row_version: 4 });
  });
});
