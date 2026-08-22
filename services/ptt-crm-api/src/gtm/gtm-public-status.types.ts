export type PublicComponentStatus = 'operational' | 'degraded' | 'outage';

export type PublicStatusComponent = {
  id: string;
  name: string;
  status: PublicComponentStatus;
  region?: string;
};

export type PublicStatusResponse = {
  updated_at: string;
  sla_target_pct: number;
  components: PublicStatusComponent[];
};
