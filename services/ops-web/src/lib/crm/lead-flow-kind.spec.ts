import { describe, expect, it } from 'vitest';
import {
  resolveLeadFlowKind,
  showB2bSalesFlowBar,
  statusOptionsForFlowKind,
} from './lead-flow-kind';

describe('lead-flow-kind re_buyer', () => {
  it('classifies explicit re_buyer', () => {
    expect(resolveLeadFlowKind({ metaJson: { lead_flow_kind: 're_buyer' } })).toBe('re_buyer');
  });

  it('classifies re_project_id as re_buyer', () => {
    expect(resolveLeadFlowKind({ metaJson: { re_project_id: 12 } })).toBe('re_buyer');
  });

  it('hides B2B bar on re_buyer', () => {
    expect(showB2bSalesFlowBar('re_buyer')).toBe(false);
  });

  it('allows xem_nha / giu_cho', () => {
    expect(statusOptionsForFlowKind('re_buyer')).toContain('xem_nha');
    expect(statusOptionsForFlowKind('re_buyer')).toContain('giu_cho');
  });
});
