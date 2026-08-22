export type OpsAlertType =
  | 'kpi_warning'
  | 'kpi_critical'
  | 'plan_ops_drift'
  | 'task_due_soon'
  | 'task_overdue'
  | 'research_pulse';

export type OpsAlertSeverity = 'info' | 'warning' | 'critical';

export type OpsAlertStatus = 'open' | 'acknowledged' | 'resolved';

export type OpsAlertRow = {
  id: number;
  lifecycle_id: number;
  dv_code: string;
  alert_type: OpsAlertType;
  severity: OpsAlertSeverity;
  title: string;
  message: string;
  source_key: string;
  status: OpsAlertStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

export type OpsAlertPayload = {
  id: number;
  lifecycle_id: number;
  dv_code: string;
  alert_type: OpsAlertType;
  severity: OpsAlertSeverity;
  title: string;
  message: string;
  status: OpsAlertStatus;
  created_at: string;
};

export type OpsHubAlertsSnapshot = {
  open_count: number;
  items: OpsAlertPayload[];
};

export type OpsDashboardInstance = {
  lifecycle_id: number;
  client_name: string;
  dv_code: string;
  dv_name: string;
  package_tier: string;
  stage: string;
  kpi_label: 'Dat' | 'CanChuY' | 'KhongDat' | null;
  tasks_done_pct: number;
  alerts_open: number;
  department?: string;
};

export type OpsDashboardAmPayload = {
  role: 'am';
  instances: OpsDashboardInstance[];
  summary: { total: number; alerts_open: number; kpi_dat_pct: number };
};

export type OpsDashboardTeamLeadPayload = {
  role: 'team_lead';
  departments: Array<{
    department: string;
    instances: OpsDashboardInstance[];
    alerts_open: number;
  }>;
};

export type OpsDashboardSpecialistTask = {
  checklist_item_id: number;
  lifecycle_id: number;
  dv_code: string;
  title: string;
  owner_role: string;
  status: string;
  iso_week: string;
};

export type OpsDashboardSpecialistPayload = {
  role: 'specialist';
  tasks: OpsDashboardSpecialistTask[];
  summary: { pending: number; done: number };
};

export type OpsDashboardExecutivePayload = {
  role: 'executive';
  summary: {
    active_instances: number;
    kpi_dat_pct: number;
    alerts_open: number;
    pilot_dv_count: number;
  };
  by_dv: Array<{ dv_code: string; name: string; instances: number; alerts_open: number }>;
};
