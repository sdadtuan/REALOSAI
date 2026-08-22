import { canSeeB2bLead, redactLeadIfDenied } from './b2b-visibility.util';

const project = 'proj-a';
const memberOn: {
  staffId: number;
  isDirector: boolean;
  hasViewAllLeads: boolean;
  isActivePttStaff: boolean;
} = {
  staffId: 10,
  isDirector: false,
  hasViewAllLeads: false,
  isActivePttStaff: true,
};

describe('canSeeB2bLead', () => {
  it('B2B-02 outsider 404', () => {
    expect(
      canSeeB2bLead(memberOn, { flowKind: 'b2b_prospect', ownerId: 99, projectId: project }, []),
    ).toBe(false);
  });

  it('B2B-03 view_all sees all', () => {
    expect(
      canSeeB2bLead(
        { ...memberOn, hasViewAllLeads: true },
        { flowKind: 'b2b_prospect', ownerId: 99, projectId: project },
        [],
      ),
    ).toBe(true);
  });

  it('B2B-03 director sees all', () => {
    expect(
      canSeeB2bLead(
        { ...memberOn, isDirector: true },
        { flowKind: 'b2b_prospect', ownerId: 99, projectId: project },
        [],
      ),
    ).toBe(true);
  });

  it('B2B-04 owner sees own when assign disabled', () => {
    expect(
      canSeeB2bLead(
        memberOn,
        { flowKind: 'b2b_prospect', ownerId: 10, projectId: project },
        [{ projectId: project, assignEnabled: false }],
      ),
    ).toBe(true);
  });

  it('B2B-05 left project keeps own lead only', () => {
    const own = canSeeB2bLead(
      memberOn,
      { flowKind: 'b2b_prospect', ownerId: 10, projectId: project },
      [],
    );
    const teammate = canSeeB2bLead(
      memberOn,
      { flowKind: 'b2b_prospect', ownerId: 11, projectId: project },
      [],
    );
    const unassigned = canSeeB2bLead(
      memberOn,
      { flowKind: 'b2b_prospect', ownerId: null, projectId: project },
      [],
    );
    expect(own).toBe(true);
    expect(teammate).toBe(false);
    expect(unassigned).toBe(false);
  });

  it('receiver sees project teammate and unassigned', () => {
    const mem = [{ projectId: project, assignEnabled: true }];
    expect(
      canSeeB2bLead(memberOn, { flowKind: 'b2b_prospect', ownerId: 11, projectId: project }, mem),
    ).toBe(true);
    expect(
      canSeeB2bLead(memberOn, { flowKind: 'b2b_prospect', ownerId: null, projectId: project }, mem),
    ).toBe(true);
  });

  it('inactive staff cannot see except view_all', () => {
    expect(
      canSeeB2bLead(
        { ...memberOn, isActivePttStaff: false },
        { flowKind: 'b2b_prospect', ownerId: 10, projectId: project },
        [{ projectId: project, assignEnabled: true }],
      ),
    ).toBe(false);
    expect(
      canSeeB2bLead(
        { ...memberOn, isActivePttStaff: false, hasViewAllLeads: true },
        { flowKind: 'b2b_prospect', ownerId: 10, projectId: project },
        [],
      ),
    ).toBe(true);
  });

  it('project manager sees teammate on same project only', () => {
    const pmMem = [{ projectId: 'p1', assignEnabled: true, role: 'project_manager' as const }];
    expect(
      canSeeB2bLead(
        memberOn,
        { flowKind: 'b2b_prospect', ownerId: 99, projectId: 'p1' },
        pmMem,
      ),
    ).toBe(true);
    expect(
      canSeeB2bLead(
        memberOn,
        { flowKind: 'b2b_prospect', ownerId: 99, projectId: 'p2' },
        pmMem,
      ),
    ).toBe(false);
  });

  it('sales does not see teammate when assign disabled', () => {
    expect(
      canSeeB2bLead(
        memberOn,
        { flowKind: 'b2b_prospect', ownerId: 99, projectId: project },
        [{ projectId: project, assignEnabled: false, role: 'sales' }],
      ),
    ).toBe(false);
  });

  it('spa leads are out of this rule (false)', () => {
    expect(
      canSeeB2bLead(
        { ...memberOn, hasViewAllLeads: true },
        { flowKind: 'spa_operational', ownerId: 10, projectId: null },
        [],
      ),
    ).toBe(false);
  });
});

describe('redactLeadIfDenied', () => {
  it('redacts name on deny', () => {
    const out = redactLeadIfDenied(false, { full_name: 'Secret', phone: '090' });
    expect(JSON.stringify(out)).not.toContain('Secret');
    expect(JSON.stringify(out)).not.toContain('090');
    expect(out).toEqual({ error: 'not_found' });
  });
});
