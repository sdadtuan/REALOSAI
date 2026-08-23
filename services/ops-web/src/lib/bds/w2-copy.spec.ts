import { describe, expect, it } from 'vitest';
import { w2ActionCopy } from './w2-copy';

describe('w2ActionCopy', () => {
  it('maps legal_gate / one_price / contract / row_version', () => {
    expect(w2ActionCopy('400 legal_gate')).toMatch(/mở đợt/i);
    expect(w2ActionCopy('400 one_price')).toMatch(/một giá|khớp CSBH/i);
    expect(w2ActionCopy('400 contract')).toMatch(/HĐ phân phối/i);
    expect(w2ActionCopy('409 row_version')).toMatch(/Làm mới/i);
    expect(w2ActionCopy('403 activate_forbidden')).toMatch(/GĐKD/i);
  });

  it('does not steal hold_closed', () => {
    expect(w2ActionCopy('409 hold_closed')).toBe('409 hold_closed');
  });
});
