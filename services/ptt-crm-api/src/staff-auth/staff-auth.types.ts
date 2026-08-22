export interface StaffSectionCap {
  section: string;
  action: string;
}

export interface StaffUserProfile {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  job_functions?: string[];
  client_ids?: string[];
}

export interface StaffLoginResult {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_expires_in: number;
  user: StaffUserProfile;
}

export interface StaffMeResponse extends StaffUserProfile {
  caps: StaffSectionCap[];
  permission_sets?: string[];
  client_ids?: string[];
}

export interface StaffRosterRow {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
}

export interface StaffRosterResponse {
  staff: StaffRosterRow[];
}

export interface StaffSsoConfigResponse {
  mode: 'nest' | 'keycloak' | 'dual';
  issuer: string | null;
  client_id: string;
  nest_login_allowed: boolean;
  mfa_required_positions: string[];
}

export interface StaffOidcExchangeBody {
  code: string;
  redirect_uri: string;
  code_verifier: string;
}

export interface StaffMfaRequiredResponse {
  error: 'mfa_required';
  message: string;
  email?: string;
}
