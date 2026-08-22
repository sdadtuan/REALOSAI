export type BdsTenantMode = 'developer' | 'broker' | 'hybrid';
export type BdsTenantStatus = 'draft' | 'active' | 'suspended';

export type BdsTenantRow = {
  id: string;
  code: string;
  name: string;
  mode: BdsTenantMode;
  status: BdsTenantStatus;
  operated_by_ptt: boolean;
};

export type CreateBdsTenantBody = {
  code: string;
  name: string;
  mode: BdsTenantMode;
  operated_by_ptt?: boolean;
};
