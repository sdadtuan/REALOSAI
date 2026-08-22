export interface DealRoomTeaserTokenRow {
  id: number;
  lead_id: number;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_by: number | null;
  created_at: string;
}

export interface DealRoomTeaserCreateResponse {
  ok: true;
  lead_id: number;
  url: string;
  expires_at: string;
  token_id: number;
}

export interface DealRoomTeaserRevokeResponse {
  ok: true;
  lead_id: number;
  revoked: boolean;
}

export interface DealRoomTeaserPublicView {
  ok: true;
  project_name: string;
  client_name: string;
  service_slug: string;
  north_star: string;
  strategy_blocks: Array<{ key: string; label: string; content: string }>;
  account_manager_name: string | null;
  contact_cta: {
    mailto_href: string;
    label: string;
  };
  expires_at: string;
}

export interface DealRoomTeaserStateView {
  active: boolean;
  url: string | null;
  expires_at: string | null;
  revoked: boolean;
}
