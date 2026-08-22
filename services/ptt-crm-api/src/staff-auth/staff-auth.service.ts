import { Injectable, UnauthorizedException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService, StaffStubUser } from '../config/app-config.service';
import { StaffJobFunctionsRepository } from '../staff-permissions/staff-job-functions.repository';
import { StaffBreakGlassRepository } from '../staff-break-glass/staff-break-glass.repository';
import { StaffPermissionSetsRepository } from '../staff-permission-sets/staff-permission-sets.repository';
import { StaffUserClientsRepository } from '../staff-client-scope/staff-user-clients.repository';
import { isSuperAdminPositionCode } from '../staff-client-scope/staff-client-scope.util';
import { verifyPortalPassword } from '../portal/portal-password.util';
import {
  StaffLoginResult,
  StaffMeResponse,
  StaffRosterResponse,
  StaffRosterRow,
  StaffSectionCap,
  StaffSsoConfigResponse,
  StaffUserProfile,
} from './staff-auth.types';
import { signStaffJwt, StaffJwtPayload, verifyStaffJwt } from './staff-jwt.util';
import { parseNumericStaffSub } from './staff-user-id.util';
import {
  exchangeStaffAuthorizationCode,
  normalizeKeycloakGroups,
  positionRequiresMfa,
  staffEmailFromClaims,
  staffMfaSatisfied,
  verifyStaffKeycloakAccessToken,
} from './staff-keycloak.util';
import { StaffAuthAuditRepository } from './staff-auth-audit.repository';
import { StaffKeycloakGroupsRepository } from './staff-keycloak-groups.repository';

const DEFAULT_STUB_CAPS: StaffSectionCap[] = [
  { section: 'dashboard', action: 'view' },
  { section: 'crm_leads', action: 'view' },
  { section: 'crm_leads', action: 'edit' },
  { section: 'crm_leads', action: 'assign' },
  { section: 'crm_presales_solution', action: 'view' },
  { section: 'crm_presales_solution', action: 'edit' },
  { section: 'crm_presales_solution', action: 'claim' },
  { section: 'crm_presales_solution', action: 'release' },
  { section: 'crm_board_customers', action: 'view' },
  { section: 'crm_board_customers', action: 'edit' },
  { section: 'crm_board_customers', action: 'create' },
  { section: 'crm_board', action: 'view' },
  { section: 'crm_board', action: 'edit' },
  { section: 'crm_sales_overview', action: 'view' },
  { section: 'crm_sales_plans', action: 'view' },
  { section: 'crm_sales_plans', action: 'create' },
  { section: 'crm_sales_funnel', action: 'view' },
  { section: 'crm_sales_training', action: 'view' },
  { section: 'crm_sales_training', action: 'create' },
  { section: 'crm_sales_market', action: 'view' },
  { section: 'crm_sales_market', action: 'create' },
  { section: 'crm_research', action: 'view' },
  { section: 'crm_research', action: 'create' },
  { section: 'crm_research', action: 'edit' },
  { section: 'crm_research', action: 'run' },
  { section: 'crm_research', action: 'approve' },
  { section: 'crm_research', action: 'export' },
  { section: 'crm_research', action: 'configure' },
  { section: 'crm_sales_prospects', action: 'view' },
  { section: 'crm_sales_prospects', action: 'create' },
  { section: 'crm_payroll_attendance', action: 'view' },
  { section: 'crm_payroll_salary', action: 'view' },
  { section: 'crm_payroll_salary', action: 'edit' },
  { section: 'crm_payroll_salary', action: 'export' },
  { section: 'crm_business_dashboard', action: 'view' },
  { section: 'crm_business_dashboard', action: 'export' },
  { section: 'crm_business_dashboard', action: 'configure' },
  { section: 'ai_analytics', action: 'query' },
  { section: 'ai_forecast', action: 'commit' },
  { section: 'crm_owner_weekly_dashboard', action: 'view' },
  { section: 'crm_owner_weekly_dashboard', action: 'export' },
  { section: 'crm_owner_weekly_dashboard', action: 'configure' },
  { section: 'crm_data_config', action: 'view' },
  { section: 'crm_data_config', action: 'configure' },
  { section: 'ai_admin', action: 'view' },
  { section: 'automation_workflows', action: 'view' },
  { section: 'automation_workflows', action: 'configure' },
  { section: 'automation_workflows', action: 'simulate' },
  { section: 'crm_search', action: 'view' },
  { section: 'crm_search', action: 'configure' },
  { section: 'playbooks', action: 'view' },
  { section: 'playbooks', action: 'configure' },
  { section: 'crm_re_projects', action: 'view' },
  { section: 'crm_re_projects', action: 'create' },
  { section: 'crm_re_projects', action: 'edit' },
  { section: 'crm_re_projects', action: 'delete' },
  { section: 'crm_re_projects', action: 'export' },
  { section: 'crm_re_projects_products', action: 'view' },
  { section: 'crm_re_projects_products', action: 'create' },
  { section: 'crm_re_projects_products', action: 'edit' },
  { section: 'crm_re_projects_products', action: 'delete' },
  { section: 'crm_re_projects_budget', action: 'view' },
  { section: 'crm_re_projects_budget', action: 'create' },
  { section: 'crm_re_projects_budget', action: 'edit' },
  { section: 'crm_re_projects_budget', action: 'delete' },
  { section: 'crm_re_projects_budget', action: 'export' },
  { section: 'crm_re_projects_kpi', action: 'view' },
  { section: 'crm_re_projects_kpi', action: 'create' },
  { section: 'crm_re_projects_kpi', action: 'edit' },
  { section: 'crm_re_projects_kpi', action: 'delete' },
  { section: 'crm_re_projects_risks', action: 'view' },
  { section: 'crm_re_projects_risks', action: 'create' },
  { section: 'crm_re_projects_risks', action: 'edit' },
  { section: 'crm_re_projects_risks', action: 'delete' },
  { section: 'crm_staff_roster', action: 'view' },
  { section: 'crm_staff_roster', action: 'edit' },
  { section: 'crm_kpi_records', action: 'view' },
  { section: 'crm_kpi_records', action: 'edit' },
  { section: 'crm_staff_kpi_am_sp', action: 'view' },
  { section: 'crm_agency', action: 'view' },
  { section: 'crm_agency', action: 'create' },
  { section: 'crm_facebook_ads', action: 'view' },
  { section: 'crm_google_ads', action: 'view' },
  { section: 'crm_google_ads', action: 'export' },
  { section: 'crm_zalo_ads', action: 'view' },
  { section: 'crm_zalo_ads', action: 'export' },
  { section: 'meta_campaign_write', action: 'view' },
  { section: 'meta_campaign_write', action: 'approve' },
  { section: 'crm_seo', action: 'view' },
  { section: 'crm_seo_aeo', action: 'view' },
  { section: 'crm_seo_aeo', action: 'edit' },
  { section: 'crm_seo_aeo_write', action: 'view' },
  { section: 'crm_seo_aeo_write', action: 'edit' },
  { section: 'crm_seo_aeo_write', action: 'create' },
  { section: 'crm_seo_aeo_settings', action: 'view' },
  { section: 'crm_seo_aeo_settings', action: 'configure' },
  { section: 'crm_seo_aeo_settings', action: 'edit' },
  { section: 'crm_seo_aeo_approve', action: 'view' },
  { section: 'crm_seo_aeo_approve', action: 'approve' },
  { section: 'crm_seo_aeo_technical', action: 'view' },
  { section: 'crm_seo_aeo_technical', action: 'edit' },
  { section: 'crm_seo_aeo_reports', action: 'view' },
  { section: 'crm_seo_aeo_reports', action: 'export' },
  { section: 'crm_email_mkt', action: 'view' },
  { section: 'crm_email_mkt', action: 'write' },
  { section: 'crm_email_mkt', action: 'settings' },
  { section: 'crm_email_mkt', action: 'compliance' },
  { section: 'crm_email_mkt', action: 'approve' },
  { section: 'crm_email_mkt', action: 'deliverability' },
  { section: 'crm_email_mkt', action: 'reports' },
];

@Injectable()
export class StaffAuthService {
  private pool: Pool | null = null;

  constructor(
    private readonly config: AppConfigService,
    @Inject(forwardRef(() => StaffJobFunctionsRepository))
    private readonly jobFunctions: StaffJobFunctionsRepository,
    @Inject(forwardRef(() => StaffPermissionSetsRepository))
    private readonly permissionSets: StaffPermissionSetsRepository,
    @Inject(forwardRef(() => StaffBreakGlassRepository))
    private readonly breakGlass: StaffBreakGlassRepository,
    @Inject(forwardRef(() => StaffUserClientsRepository))
    private readonly userClients: StaffUserClientsRepository,
    private readonly authAudit: StaffAuthAuditRepository,
    private readonly keycloakGroups: StaffKeycloakGroupsRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  /** Map staff JWT (UUID sub) to numeric crm_staff.id for PG bigint columns. */
  async resolveCrmStaffUserId(payload: StaffJwtPayload | undefined): Promise<number | null> {
    if (!payload?.sub) return null;
    const numeric = parseNumericStaffSub(payload.sub);
    if (numeric != null) return numeric;
    const email = payload.email?.trim();
    if (!email) return null;
    try {
      const result = await this.db.query(
        `SELECT id FROM crm_staff
         WHERE active = TRUE AND lower(trim(email)) = lower(trim($1))
         LIMIT 1`,
        [email],
      );
      const id = result.rows[0]?.id;
      return id != null ? Number(id) : null;
    } catch {
      return null;
    }
  }

  async login(email: string, password: string): Promise<StaffLoginResult> {
    if (!this.config.staffNestLoginAllowed()) {
      throw new UnauthorizedException({ error: 'password_login_disabled' });
    }
    const normalized = email.trim().toLowerCase();
    const user = await this.resolveUser(normalized, password);
    if (!user) {
      throw new UnauthorizedException({ error: 'Invalid credentials' });
    }
    void this.authAudit.write('fallback_password', {
      userId: user.id,
      email: user.email,
      detail: { mode: this.config.staffAuthMode },
    });
    return this.issueTokens(user);
  }

  async exchangeOidc(params: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<StaffLoginResult> {
    const issuer = this.config.staffKeycloakIssuer;
    if (!issuer) {
      throw new UnauthorizedException({ error: 'staff_sso_not_configured' });
    }
    if (this.config.staffAuthMode === 'nest') {
      throw new UnauthorizedException({ error: 'staff_sso_disabled' });
    }

    let tokenResponse;
    try {
      tokenResponse = await exchangeStaffAuthorizationCode({
        issuer,
        fetchIssuer: this.config.staffKeycloakFetchIssuer ?? issuer,
        clientId: this.config.staffKeycloakClientId,
        code: params.code,
        redirectUri: params.redirectUri,
        codeVerifier: params.codeVerifier,
      });
    } catch (err) {
      throw new UnauthorizedException({
        error: 'oidc_exchange_failed',
        message: err instanceof Error ? err.message : 'exchange failed',
      });
    }

    const claims = await verifyStaffKeycloakAccessToken(tokenResponse.access_token, {
      issuer,
      fetchIssuer: this.config.staffKeycloakFetchIssuer ?? issuer,
      audience: this.config.staffKeycloakAudience,
    });
    if (!claims) {
      throw new UnauthorizedException({ error: 'invalid_keycloak_token' });
    }

    const email = staffEmailFromClaims(claims);
    if (!email) {
      throw new UnauthorizedException({ error: 'missing_email_claim' });
    }

    const groups = normalizeKeycloakGroups(claims.groups);
    const linked = await this.linkOidcUser(claims.sub, email, groups);
    if (!linked) {
      throw new UnauthorizedException({ error: 'user_not_provisioned', email });
    }

    const positionCode = await this.loadPositionCode(linked.positionId);
    if (
      positionRequiresMfa(positionCode, this.config.staffMfaRequiredPositionCodes) &&
      !staffMfaSatisfied(claims)
    ) {
      void this.authAudit.write('mfa_blocked', {
        userId: linked.id,
        email: linked.email,
        detail: { position_code: positionCode, acr: claims.acr ?? null },
      });
      throw new ForbiddenException({
        error: 'mfa_required',
        message: 'OTP bắt buộc cho chức vụ này',
        email: linked.email,
      });
    }

    void this.authAudit.write(linked.linkedNew ? 'sso_link' : 'sso_login', {
      userId: linked.id,
      email: linked.email,
      detail: { groups, oidc_sub: claims.sub },
    });

    return this.issueTokens(linked);
  }

  getSsoConfig(): StaffSsoConfigResponse {
    return {
      mode: this.config.staffAuthMode,
      issuer: this.config.staffKeycloakIssuer,
      client_id: this.config.staffKeycloakClientId,
      nest_login_allowed: this.config.staffNestLoginAllowed(),
      mfa_required_positions: this.config.staffMfaRequiredPositionCodes,
    };
  }

  async assertConfigureSso(user: StaffJwtPayload): Promise<void> {
    const caps = await this.loadCaps(user.position_id);
    if (!this.hasCap(caps, 'crm_data_config', 'configure')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_data_config', action: 'configure' });
    }
  }

  async refresh(refreshToken: string): Promise<StaffLoginResult> {
    const payload = verifyStaffJwt(refreshToken, this.config.staffJwtSecret);
    if (!payload || payload.token_type !== 'refresh') {
      throw new UnauthorizedException({ error: 'Invalid or expired refresh token' });
    }
    await this.assertTokenVersion(payload);
    return this.issueTokens({
      id: payload.sub,
      email: payload.email,
      displayName: payload.display_name,
      positionId: payload.position_id,
      tokenVersion: payload.tv ?? 0,
    });
  }

  async verifyAccessToken(token: string): Promise<StaffJwtPayload> {
    const payload = verifyStaffJwt(token, this.config.staffJwtSecret);
    if (!payload || payload.token_type !== 'access') {
      throw new UnauthorizedException({ error: 'Invalid or expired token' });
    }
    await this.assertTokenVersion(payload);
    return payload;
  }

  async me(accessPayload: StaffJwtPayload): Promise<StaffMeResponse> {
    const baseCaps = await this.loadCaps(accessPayload.position_id);
    const jobFunctions = await this.jobFunctions.loadUserFunctionCodes(accessPayload.sub);
    const functionCaps = await this.jobFunctions.loadCapsForFunctions(jobFunctions);
    const setCaps = await this.permissionSets.loadCapsForUser(accessPayload.sub);
    const breakGlassCaps = await this.breakGlass.loadActiveCapsForUser(accessPayload.sub);
    const caps = this.mergeCaps(baseCaps, [
      ...functionCaps,
      ...setCaps,
      ...breakGlassCaps.map((cap) => ({ section_id: cap.section, action: cap.action })),
    ]);
    const permission_sets = await this.permissionSets.loadUserSetCodes(accessPayload.sub);
    const position_code = await this.loadPositionCode(accessPayload.position_id);
    const client_ids = await this.resolveJwtClientIds(accessPayload.sub, position_code);
    return {
      id: accessPayload.sub,
      email: accessPayload.email,
      display_name: accessPayload.display_name,
      position_id: accessPayload.position_id,
      position_code: position_code ?? undefined,
      job_functions: jobFunctions.length ? jobFunctions : undefined,
      permission_sets: permission_sets.length ? permission_sets : undefined,
      client_ids,
      caps,
    };
  }

  isSuperAdminPosition(positionCode: string | null | undefined): boolean {
    return isSuperAdminPositionCode(positionCode);
  }

  async loadPositionCodePublic(positionId: number): Promise<string | null> {
    return this.loadPositionCode(positionId);
  }

  private async resolveJwtClientIds(
    userId: string,
    positionCode: string | null,
  ): Promise<string[] | undefined> {
    if (!this.config.staffScopePilotEnabled) return undefined;
    if (isSuperAdminPositionCode(positionCode)) return undefined;
    const ids = await this.userClients.loadClientIdsForUser(userId);
    return ids.length ? ids : undefined;
  }

  async listActiveStaff(): Promise<StaffRosterResponse> {
    const staff: StaffRosterRow[] = [];
    if (this.config.staffAllowStubUsers) {
      for (const stub of this.config.staffStubUsers) {
        staff.push({
          id: stub.staffId,
          email: stub.email,
          display_name: stub.displayName || stub.email,
          position_id: stub.positionId,
        });
      }
    }
    try {
      const result = await this.db.query(
        `SELECT id::text, email, display_name, position_id
         FROM staff_users
         WHERE active IS TRUE
         ORDER BY display_name, email`,
      );
      for (const row of result.rows) {
        staff.push({
          id: String(row.id),
          email: String(row.email),
          display_name: String(row.display_name || row.email),
          position_id: Number(row.position_id),
        });
      }
    } catch {
      /* staff_users may not exist on fresh dev */
    }
    const seen = new Set<string>();
    const deduped = staff.filter((row) => {
      const key = row.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) =>
      (a.display_name || a.email).localeCompare(b.display_name || b.email, 'vi'),
    );
    return { staff: deduped };
  }

  hasCap(caps: StaffSectionCap[], section: string, action: string): boolean {
    return caps.some((c) => c.section === section && c.action === action);
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    displayName: string;
    positionId: number;
    tokenVersion?: number;
  }): Promise<StaffLoginResult> {
    const position_code = await this.loadPositionCode(user.positionId);
    const client_ids = await this.resolveJwtClientIds(user.id, position_code);
    const tv = user.tokenVersion ?? (await this.loadTokenVersion(user.id)) ?? 0;
    const base = {
      sub: user.id,
      email: user.email,
      display_name: user.displayName,
      position_id: user.positionId,
      tv,
      ...(client_ids?.length ? { client_ids } : {}),
    };
    const accessToken = signStaffJwt(
      { ...base, token_type: 'access' },
      this.config.staffJwtSecret,
      this.config.staffJwtTtlSec,
    );
    const refreshToken = signStaffJwt(
      { ...base, token_type: 'refresh' },
      this.config.staffJwtSecret,
      this.config.staffRefreshTtlSec,
    );
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.config.staffJwtTtlSec,
      refresh_expires_in: this.config.staffRefreshTtlSec,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
        position_id: user.positionId,
        position_code: position_code ?? undefined,
        client_ids,
      },
    };
  }

  async hasCapForPosition(positionId: number, section: string, action: string): Promise<boolean> {
    const caps = await this.loadCaps(positionId);
    return this.hasCap(caps, section, action);
  }

  private async resolveUser(
    email: string,
    password: string,
  ): Promise<(StaffUserProfile & { displayName: string; positionId: number }) | null> {
    if (this.config.staffAllowStubUsers) {
      const stub = this.config.staffStubUsers.find(
        (u) => u.email === email && u.password === password,
      );
      if (stub) {
        return {
          id: stub.staffId,
          email: stub.email,
          display_name: stub.displayName,
          displayName: stub.displayName,
          position_id: stub.positionId,
          positionId: stub.positionId,
        };
      }
    }
    try {
      const result = await this.db.query(
        `SELECT id::text, email, password_hash, display_name, position_id, expires_at
         FROM staff_users
         WHERE LOWER(email) = $1 AND active IS TRUE
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1`,
        [email],
      );
      const row = result.rows[0] as
        | {
            id: string;
            email: string;
            password_hash: string;
            display_name: string;
            position_id: number;
            expires_at: string | null;
          }
        | undefined;
      if (!row || !verifyPortalPassword(password, row.password_hash)) {
        return null;
      }
      void this.db.query(`UPDATE staff_users SET last_login_at = NOW() WHERE id = $1::uuid`, [
        row.id,
      ]);
      return {
        id: row.id,
        email: row.email,
        display_name: row.display_name || row.email,
        displayName: row.display_name || row.email,
        position_id: row.position_id,
        positionId: row.position_id,
      };
    } catch {
      return null;
    }
  }

  private mergeCaps(base: StaffSectionCap[], extra: Array<{ section_id: string; action: string }>): StaffSectionCap[] {
    const map = new Map<string, StaffSectionCap>();
    for (const cap of base) {
      map.set(`${cap.section}:${cap.action}`, cap);
    }
    for (const cap of extra) {
      map.set(`${cap.section_id}:${cap.action}`, { section: cap.section_id, action: cap.action });
    }
    return [...map.values()].sort((a, b) =>
      `${a.section}:${a.action}`.localeCompare(`${b.section}:${b.action}`, 'vi'),
    );
  }

  private async loadPositionCode(positionId: number): Promise<string | null> {
    try {
      const result = await this.db.query<{ code: string }>(
        `SELECT code FROM crm_positions WHERE id = $1 LIMIT 1`,
        [positionId],
      );
      return result.rows[0]?.code ? String(result.rows[0].code) : null;
    } catch {
      return null;
    }
  }

  async loadCaps(positionId: number): Promise<StaffSectionCap[]> {
    try {
      const result = await this.db.query(
        `SELECT section_id, action
         FROM staff_section_permissions
         WHERE position_id = $1
         ORDER BY section_id, action`,
        [positionId],
      );
      if (result.rowCount && result.rowCount > 0) {
        return result.rows.map((row) => ({
          section: String(row.section_id),
          action: String(row.action),
        }));
      }
    } catch {
      // table may not exist yet on fresh dev
    }
    return DEFAULT_STUB_CAPS;
  }

  private async loadTokenVersion(userId: string): Promise<number | null> {
    if (parseNumericStaffSub(userId) != null && this.config.staffAllowStubUsers) {
      return 0;
    }
    try {
      const result = await this.db.query<{ auth_token_version: number }>(
        `SELECT auth_token_version FROM staff_users WHERE id = $1::uuid LIMIT 1`,
        [userId],
      );
      if (!result.rows[0]) return null;
      return Number(result.rows[0].auth_token_version ?? 0);
    } catch {
      return null;
    }
  }

  private async assertTokenVersion(payload: StaffJwtPayload): Promise<void> {
    if (parseNumericStaffSub(payload.sub) != null && this.config.staffAllowStubUsers) {
      return;
    }
    const current = await this.loadTokenVersion(payload.sub);
    if (current == null) {
      return;
    }
    const tokenTv = payload.tv ?? 0;
    if (tokenTv !== current) {
      void this.authAudit.write('token_revoked', {
        userId: payload.sub,
        email: payload.email,
        detail: { token_tv: tokenTv, current_tv: current },
      });
      throw new UnauthorizedException({ error: 'token_revoked' });
    }
  }

  private async linkOidcUser(
    oidcSub: string,
    email: string,
    groups: string[],
  ): Promise<
    (StaffUserProfile & { displayName: string; positionId: number; tokenVersion: number; linkedNew: boolean }) | null
  > {
    type StaffOidcRow = {
      id: string;
      email: string;
      display_name: string;
      position_id: number;
      auth_token_version: number;
      oidc_sub: string | null;
    };

    try {
      const bySub = await this.db.query(
        `SELECT id::text, email, display_name, position_id, auth_token_version, oidc_sub
         FROM staff_users
         WHERE oidc_sub = $1 AND active IS TRUE
         LIMIT 1`,
        [oidcSub],
      );
      let row = bySub.rows[0] as StaffOidcRow | undefined;
      let linkedNew = false;

      if (!row) {
        const byEmail = await this.db.query(
          `SELECT id::text, email, display_name, position_id, auth_token_version, oidc_sub
           FROM staff_users
           WHERE LOWER(email) = $1 AND active IS TRUE
           LIMIT 1`,
          [email],
        );
        row = byEmail.rows[0] as StaffOidcRow | undefined;
        if (row && !row.oidc_sub) {
          await this.db.query(
            `UPDATE staff_users SET oidc_sub = $1, updated_at = NOW(), last_login_at = NOW() WHERE id = $2::uuid`,
            [oidcSub, row.id],
          );
          linkedNew = true;
        }
      } else {
        void this.db.query(`UPDATE staff_users SET last_login_at = NOW() WHERE id = $1::uuid`, [row.id]);
      }

      if (!row) {
        const mapped = await this.keycloakGroups.resolvePositionFromGroups(groups);
        if (!mapped) {
          return null;
        }
        return null;
      }

      return {
        id: row.id,
        email: row.email,
        display_name: row.display_name || row.email,
        displayName: row.display_name || row.email,
        position_id: row.position_id,
        positionId: row.position_id,
        tokenVersion: Number(row.auth_token_version ?? 0),
        linkedNew,
      };
    } catch {
      return null;
    }
  }
}
