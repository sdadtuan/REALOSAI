export type NlQueryResultKind = 'table' | 'chart';

export type NlQueryCategory = 'leads' | 'revenue' | 'ops' | 'ai' | 'forecast' | 'health';

export interface NlQueryColumn {
  key: string;
  label: string;
  type?: 'number' | 'string' | 'currency' | 'pct';
}

export interface NlQueryChartSeries {
  key: string;
  label: string;
  values: number[];
}

export interface NlQueryChart {
  type: 'bar' | 'line';
  labels: string[];
  series: NlQueryChartSeries[];
}

export interface NlQueryExecutionResult {
  columns: NlQueryColumn[];
  rows: Array<Record<string, unknown>>;
  chart?: NlQueryChart;
  drill_href?: string;
}

export interface NlQueryCatalogEntry {
  id: string;
  label: string;
  aliases: string[];
  category: NlQueryCategory;
  result_kind: NlQueryResultKind;
  description: string;
}

export interface NlQueryResultPayload {
  intent_id: string;
  label: string;
  narrative: string;
  result_kind: NlQueryResultKind;
  columns: NlQueryColumn[];
  rows: Array<Record<string, unknown>>;
  chart?: NlQueryChart;
  read_only: true;
  drill_href?: string;
}

export interface NlQueryCatalogResponse {
  data: {
    intents: NlQueryCatalogEntry[];
    total: number;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface NlQueryRunRequest {
  intent_id?: string;
  question?: string;
  actorId?: string | null;
  correlationId?: string;
}

export interface NlQueryRunResponse {
  data: NlQueryResultPayload;
  meta: { request_id: string; agent_run_id?: string };
  errors: unknown[];
}
