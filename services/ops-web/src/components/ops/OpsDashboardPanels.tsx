'use client';

import Link from 'next/link';
import type {
  OpsDashboardAmPayload,
  OpsDashboardExecutivePayload,
  OpsDashboardSpecialistPayload,
  OpsDashboardTeamLeadPayload,
} from '@/lib/ops-dv-api';

function kpiLabelVi(label: string | null): string {
  if (label === 'Dat') return 'Đạt';
  if (label === 'CanChuY') return 'Cần chú ý';
  if (label === 'KhongDat') return 'Không đạt';
  return '—';
}

export function OpsAmDashboardPanel({ data }: { data: OpsDashboardAmPayload }) {
  return (
    <section>
      <p className="muted">
        {data.summary.total} instance · {data.summary.alerts_open} cảnh báo mở · KPI đạt{' '}
        {data.summary.kpi_dat_pct}%
      </p>
      <table className="table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Khách</th>
            <th>DV</th>
            <th>KPI</th>
            <th>Task %</th>
            <th>Cảnh báo</th>
          </tr>
        </thead>
        <tbody>
          {data.instances.map((row) => (
            <tr key={row.lifecycle_id}>
              <td>
                <Link href={`/crm/service-delivery/${row.lifecycle_id}?tab=ops-hub`} className="nav-link">
                  {row.client_name}
                </Link>
              </td>
              <td>
                {row.dv_code} — {row.dv_name}
              </td>
              <td>{kpiLabelVi(row.kpi_label)}</td>
              <td>{row.tasks_done_pct}%</td>
              <td>{row.alerts_open}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function OpsTeamLeadDashboardPanel({ data }: { data: OpsDashboardTeamLeadPayload }) {
  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {data.departments.map((dept) => (
        <section key={dept.department}>
          <h4 style={{ margin: '0 0 0.5rem' }}>
            {dept.department} · {dept.alerts_open} cảnh báo
          </h4>
          <OpsAmDashboardPanel
            data={{
              role: 'am',
              instances: dept.instances,
              summary: {
                total: dept.instances.length,
                alerts_open: dept.alerts_open,
                kpi_dat_pct: 0,
              },
            }}
          />
        </section>
      ))}
    </div>
  );
}

export function OpsSpecialistDashboardPanel({ data }: { data: OpsDashboardSpecialistPayload }) {
  return (
    <section>
      <p className="muted">
        {data.summary.pending} pending · {data.summary.done} done
      </p>
      <table className="table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Task</th>
            <th>DV</th>
            <th>Owner</th>
            <th>Tuần</th>
          </tr>
        </thead>
        <tbody>
          {data.tasks.map((task) => (
            <tr key={task.checklist_item_id}>
              <td>
                <Link
                  href={`/crm/service-delivery/${task.lifecycle_id}?tab=ops-hub`}
                  className="nav-link"
                >
                  {task.title}
                </Link>
              </td>
              <td>{task.dv_code}</td>
              <td>{task.owner_role}</td>
              <td>{task.iso_week}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function OpsExecutiveDashboardPanel({ data }: { data: OpsDashboardExecutivePayload }) {
  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <strong>{data.summary.active_instances}</strong>
          <p className="muted" style={{ margin: 0 }}>
            Instance active
          </p>
        </div>
        <div>
          <strong>{data.summary.kpi_dat_pct}%</strong>
          <p className="muted" style={{ margin: 0 }}>
            KPI đạt
          </p>
        </div>
        <div>
          <strong>{data.summary.alerts_open}</strong>
          <p className="muted" style={{ margin: 0 }}>
            Cảnh báo mở
          </p>
        </div>
        <div>
          <strong>{data.summary.pilot_dv_count}</strong>
          <p className="muted" style={{ margin: 0 }}>
            DV pilot
          </p>
        </div>
      </div>
      <table className="table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>DV</th>
            <th>Instances</th>
            <th>Cảnh báo</th>
          </tr>
        </thead>
        <tbody>
          {data.by_dv.map((row) => (
            <tr key={row.dv_code}>
              <td>
                {row.dv_code} — {row.name}
              </td>
              <td>{row.instances}</td>
              <td>{row.alerts_open}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
