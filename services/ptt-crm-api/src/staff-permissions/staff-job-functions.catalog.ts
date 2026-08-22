export type JobFunctionDef = {
  code: string;
  label: string;
  description: string;
  department_scope: string;
  sort_order: number;
};

/** Default add-on grants per function (union with position base). */
export const DEFAULT_JOB_FUNCTION_GRANTS: Record<string, Record<string, string[]>> = {
  leader: {
    crm_leads: ['assign'],
    crm_kpi_records: ['export', 'configure'],
    crm_staff_kpi_am_sp: ['view'],
    crm_presales_solution: ['release'],
  },
  sales: {},
  content: {
    crm_seo_aeo_write: ['create', 'edit'],
    crm_email_mkt: ['write', 'reports'],
  },
  design: {
    crm_facebook_ads: ['edit'],
    meta_campaign_write: ['view'],
  },
  analyst: {
    crm_business_dashboard: ['export'],
    crm_sales_funnel: ['export'],
    crm_kpi_chart: ['export'],
  },
  ops: {},
  technical: {
    crm_seo_aeo_technical: ['view', 'configure'],
    crm_seo_aeo_settings: ['configure'],
  },
  compliance: {
    crm_email_mkt: ['compliance', 'deliverability'],
  },
};

export const JOB_FUNCTION_CATALOG: JobFunctionDef[] = [
  { code: 'leader', label: 'Trưởng nhóm', description: 'Assign trong team, export KPI', department_scope: 'All', sort_order: 1 },
  { code: 'sales', label: 'Kinh doanh', description: 'Lead B2B, agency client', department_scope: 'DEPT-SALES', sort_order: 2 },
  { code: 'content', label: 'Content / Copy', description: 'SEO write, email write', department_scope: 'DEPT-SOLUTION, DEPT-AGENCY', sort_order: 3 },
  { code: 'design', label: 'Design / Creative', description: 'Meta/FB creative', department_scope: 'DEPT-SOLUTION, DEPT-AGENCY', sort_order: 4 },
  { code: 'analyst', label: 'Phân tích / BI', description: 'Dashboard export', department_scope: 'All', sort_order: 5 },
  { code: 'ops', label: 'Vận hành', description: 'CSKH board, SOP', department_scope: 'DEPT-CSKH, DEPT-HR', sort_order: 6 },
  { code: 'technical', label: 'Kỹ thuật SEO', description: 'Technical SEO, GSC', department_scope: 'DEPT-AGENCY', sort_order: 7 },
  { code: 'compliance', label: 'Tuân thủ', description: 'Email compliance', department_scope: 'DEPT-AGENCY', sort_order: 8 },
];
