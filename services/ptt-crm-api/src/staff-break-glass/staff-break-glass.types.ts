export type BreakGlassCap = { section: string; action: string };

export type BreakGlassGrantRow = {
  id: string;
  user_id: string;
  user_email?: string;
  user_display_name?: string;
  caps: BreakGlassCap[];
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';
  requested_at: string;
  approved_by: string;
  approved_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
};

export type RequestBreakGlassBody = {
  reason: string;
  caps_requested: BreakGlassCap[];
};

export type ApproveBreakGlassBody = {
  approve?: boolean;
  reject_reason?: string;
};

export type BreakGlassListResponse = {
  grants: BreakGlassGrantRow[];
};
