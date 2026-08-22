import { buildOrgChartForest } from './staff-org-chart.util';
import type { StaffOrgChartNode } from './staff-org.types';

describe('buildOrgChartForest', () => {
  const nodes: StaffOrgChartNode[] = [
    {
      id: 1,
      name: 'CEO',
      reports_to_id: null,
      department: 'BOD',
      job_title: 'CEO',
      position_code: 'CEO',
      active: true,
    },
    {
      id: 2,
      name: 'Alice',
      reports_to_id: 1,
      department: 'MKT',
      job_title: 'Lead',
      position_code: 'MKT-01',
      active: true,
    },
    {
      id: 3,
      name: 'Bob',
      reports_to_id: 1,
      department: 'Sales',
      job_title: 'Lead',
      position_code: 'SALES-01',
      active: true,
    },
  ];

  it('nests children under reports_to_id', () => {
    const forest = buildOrgChartForest(nodes);
    expect(forest).toHaveLength(1);
    expect(forest[0]!.name).toBe('CEO');
    expect(forest[0]!.children.map((c) => c.name).sort()).toEqual(['Alice', 'Bob']);
  });

  it('treats orphan nodes as roots', () => {
    const forest = buildOrgChartForest([
      ...nodes,
      {
        id: 99,
        name: 'Orphan',
        reports_to_id: 404,
        department: '',
        job_title: '',
        position_code: null,
        active: true,
      },
    ]);
    expect(forest.map((r) => r.name).sort()).toEqual(['CEO', 'Orphan']);
  });
});
