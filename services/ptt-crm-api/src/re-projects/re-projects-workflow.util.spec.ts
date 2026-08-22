import { computeProjectWorkflow } from './re-projects-workflow.util';

function stepStatus(wf: Record<string, unknown>, id: string): string {
  const steps = wf.steps as Array<{ id: string; status: string }>;
  return steps.find((s) => s.id === id)!.status;
}

describe('computeProjectWorkflow BDS-29', () => {
  const proj = { business_plan: { vision: 'x', approval_status: 'approved' } } as any;

  it('BDS-29 business done only after approved revision when kinds passed', () => {
    const empty = computeProjectWorkflow(1, proj, {}, { approvedKinds: [] });
    expect(stepStatus(empty, 'business')).not.toBe('done');
    expect(['pending', 'in_progress']).toContain(stepStatus(empty, 'business'));

    const done = computeProjectWorkflow(1, proj, {}, { approvedKinds: ['business'] });
    expect(stepStatus(done, 'business')).toBe('done');
  });

  it('omitted approvedKinds keeps JSON approval_status as done', () => {
    const wf = computeProjectWorkflow(1, proj, {});
    expect(stepStatus(wf, 'business')).toBe('done');
  });

  it('marketing done only after approved revision when kinds passed', () => {
    const marketingProj = {
      marketing_plan: { positioning: 'x', approval_status: 'approved' },
    } as any;
    const empty = computeProjectWorkflow(1, marketingProj, {}, { approvedKinds: [] });
    expect(stepStatus(empty, 'marketing')).not.toBe('done');
    expect(['pending', 'in_progress']).toContain(stepStatus(empty, 'marketing'));

    const done = computeProjectWorkflow(1, marketingProj, {}, { approvedKinds: ['marketing'] });
    expect(stepStatus(done, 'marketing')).toBe('done');
  });

  it('sales done only after approved revision when kinds passed', () => {
    const salesProj = {
      sales_plan: { pricing_strategy: 'x', approval_status: 'approved' },
    } as any;
    const empty = computeProjectWorkflow(1, salesProj, {}, { approvedKinds: [] });
    expect(stepStatus(empty, 'sales')).not.toBe('done');
    expect(['pending', 'in_progress']).toContain(stepStatus(empty, 'sales'));

    const done = computeProjectWorkflow(1, salesProj, {}, { approvedKinds: ['sales'] });
    expect(stepStatus(done, 'sales')).toBe('done');
  });
});
