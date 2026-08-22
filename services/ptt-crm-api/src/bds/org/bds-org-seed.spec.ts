const queryMock = jest.fn().mockResolvedValue({ rows: [] });

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: (...args: unknown[]) => queryMock(...args),
    end: jest.fn().mockResolvedValue(undefined),
  })),
}));

import {
  BDS_DEPARTMENT_SEEDS,
  BDS_POSITION_SEEDS,
  BdsOrgSeedService,
  missingRequiredPositions,
} from './bds-org-seed';

const ACTOR = 'bds-org-seed';

function makeOrg() {
  const depts: Array<{
    id: number;
    code: string;
    name: string;
    parent_id: null;
    active: boolean;
  }> = [];
  const teams: Array<{
    id: number;
    code: string;
    name: string;
    department_id: number;
    active: boolean;
  }> = [];
  return {
    depts,
    teams,
    listDepartments: jest.fn(async () => depts.slice()),
    createDepartment: jest.fn(
      async (body: { code: string; name: string }, _actor: string) => {
        const row = {
          id: depts.length + 1,
          code: body.code,
          name: body.name,
          parent_id: null,
          active: true,
        };
        depts.push(row);
        return row;
      },
    ),
    listTeams: jest.fn(async () => teams.slice()),
    createTeam: jest.fn(
      async (
        body: { code: string; name: string; department_id: number },
        _actor: string,
      ) => {
        const row = {
          id: teams.length + 1,
          code: body.code,
          name: body.name,
          department_id: body.department_id,
          active: true,
        };
        teams.push(row);
        return row;
      },
    ),
  };
}

function makeService(org: ReturnType<typeof makeOrg>) {
  return new BdsOrgSeedService(org as never, { databaseUrl: 'postgresql://test' } as never);
}

describe('bds-org-seed', () => {
  beforeEach(() => {
    queryMock.mockClear();
    queryMock.mockResolvedValue({ rows: [] });
  });

  it('seeds 12 departments and 18 positions', () => {
    expect(BDS_DEPARTMENT_SEEDS).toHaveLength(12);
    expect(BDS_POSITION_SEEDS).toHaveLength(18);
  });

  it('BR-34 lists five required positions', () => {
    expect(missingRequiredPositions(['pm_du_an', 'gdkd'])).toEqual([
      'truong_pc',
      'truong_collection',
      'truong_sp',
    ]);
    expect(
      missingRequiredPositions([
        'pm_du_an',
        'gdkd',
        'truong_pc',
        'truong_collection',
        'truong_sp',
      ]),
    ).toEqual([]);
  });

  it('skips CĐT rooms when mode is broker', async () => {
    const org = makeOrg();
    const svc = makeService(org);
    await svc.seedForTenant('tid', 'broker');
    expect(org.listDepartments).not.toHaveBeenCalled();
    expect(org.createDepartment).not.toHaveBeenCalled();
    expect(org.createTeam).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('seeds missing departments, teams, and positions for developer', async () => {
    const org = makeOrg();
    const svc = makeService(org);
    await svc.seedForTenant('tid', 'developer');

    expect(org.createDepartment).toHaveBeenCalledTimes(12);
    expect(org.createTeam).toHaveBeenCalledTimes(12);
    for (const seed of BDS_DEPARTMENT_SEEDS) {
      expect(org.createDepartment).toHaveBeenCalledWith(
        { code: seed.code, name: seed.name },
        ACTOR,
      );
    }
    for (const teamCall of org.createTeam.mock.calls) {
      expect(teamCall[1]).toBe(ACTOR);
      const body = teamCall[0] as { code: string; name: string; department_id: number };
      const dept = org.depts.find((d) => d.code === body.code);
      expect(dept).toBeDefined();
      expect(body.name).toBe(dept?.name);
      expect(body.department_id).toBe(dept?.id);
    }
    expect(queryMock).toHaveBeenCalledTimes(18);
    for (const pos of BDS_POSITION_SEEDS) {
      const match = queryMock.mock.calls.find(
        (c) => c[1] && (c[1] as unknown[])[0] === pos.code,
      );
      expect(match).toBeDefined();
      expect(String(match?.[0])).toContain('INSERT INTO crm_positions');
      expect(String(match?.[0])).toContain('NOT EXISTS');
      expect(match?.[1]).toEqual([pos.code, pos.name, pos.department_code]);
    }
  });

  it('does not duplicate departments or teams on second run', async () => {
    const org = makeOrg();
    const svc = makeService(org);
    await svc.seedForTenant('tid', 'hybrid');
    org.createDepartment.mockClear();
    org.createTeam.mockClear();
    queryMock.mockClear();
    await svc.seedForTenant('tid', 'hybrid');
    expect(org.createDepartment).not.toHaveBeenCalled();
    expect(org.createTeam).not.toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledTimes(18);
  });
});
