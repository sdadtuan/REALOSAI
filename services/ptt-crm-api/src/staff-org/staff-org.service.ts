import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJobFunctionsRepository } from '../staff-permissions/staff-job-functions.repository';
import { StaffBreakGlassRepository } from '../staff-break-glass/staff-break-glass.repository';
import { StaffUserClientsRepository } from '../staff-client-scope/staff-user-clients.repository';
import { StaffPermissionSetsRepository } from '../staff-permission-sets/staff-permission-sets.repository';
import { JOB_FUNCTION_CATALOG } from '../staff-permissions/staff-job-functions.catalog';
import {
  normalizeFunctionCodes,
  validateJobFunctionAssignment,
} from './staff-org.sod.util';
import { StaffOrgRepository } from './staff-org.repository';
import { StaffOrgUsersRepository } from './staff-org-users.repository';
import type {
  CreateStaffDepartmentBody,
  CreateStaffOrgUserBody,
  CreateStaffOrgUserResponse,
  CreateStaffTeamBody,
  OffboardStaffOrgUserBody,
  OffboardStaffOrgUserResponse,
  PatchStaffDepartmentBody,
  PatchStaffOrgPositionBody,
  PatchStaffOrgUserBody,
  PatchStaffTeamBody,
  PutStaffUserJobFunctionsBody,
  PutStaffUserClientScopeBody,
  StaffOrgUserSummary,
  StaffUserClientScopeResponse,
  ImportStaffUserClientScopeBody,
  ImportStaffUserClientScopeResponse,
  StaffUserEffectiveCapsResponse,
  StaffUserJobFunctionsResponse,
} from './staff-org.types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ResolvedUser = {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
};

@Injectable()
export class StaffOrgService implements OnModuleDestroy {
  private pool: Pool | null = null;
  private orgRepo: StaffOrgRepository | null = null;
  private usersRepo: StaffOrgUsersRepository | null = null;

  constructor(
    private readonly config: AppConfigService,
    private readonly staffAuth: StaffAuthService,
    private readonly jobFunctions: StaffJobFunctionsRepository,
    private readonly permissionSets: StaffPermissionSetsRepository,
    private readonly breakGlass: StaffBreakGlassRepository,
    private readonly userClients: StaffUserClientsRepository,
  ) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  private get repository(): StaffOrgRepository {
    if (!this.orgRepo) {
      this.orgRepo = new StaffOrgRepository(this.db);
    }
    return this.orgRepo;
  }

  private get usersRepository(): StaffOrgUsersRepository {
    if (!this.usersRepo) {
      this.usersRepo = new StaffOrgUsersRepository(this.db);
    }
    return this.usersRepo;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
    this.orgRepo = null;
    this.usersRepo = null;
  }

  listDepartments() {
    return this.repository.listDepartments();
  }

  createDepartment(body: CreateStaffDepartmentBody, actorEmail: string) {
    return this.repository.createDepartment(body, actorEmail);
  }

  patchDepartment(id: number, body: PatchStaffDepartmentBody, actorEmail: string) {
    return this.repository.patchDepartment(id, body, actorEmail);
  }

  listTeams(departmentId?: number) {
    return this.repository.listTeams(departmentId);
  }

  createTeam(body: CreateStaffTeamBody, actorEmail: string) {
    return this.repository.createTeam(body, actorEmail);
  }

  patchTeam(id: number, body: PatchStaffTeamBody, actorEmail: string) {
    return this.repository.patchTeam(id, body, actorEmail);
  }

  listPositions() {
    return this.repository.listPositions();
  }

  listOrgChart(includeInactive?: boolean) {
    return this.repository.listOrgChart(Boolean(includeInactive));
  }

  patchPosition(id: number, body: PatchStaffOrgPositionBody, actorEmail: string) {
    return this.repository.patchPosition(id, body, actorEmail);
  }

  listJobFunctionCatalog() {
    return JOB_FUNCTION_CATALOG.map((fn) => ({
      code: fn.code,
      label: fn.label,
      description: fn.description,
      department_scope: fn.department_scope,
    }));
  }

  async listUsers(opts?: { q?: string; includeInactive?: boolean }): Promise<StaffOrgUserSummary[]> {
    try {
      const rows = await this.usersRepository.listUsers(opts);
      const enriched: StaffOrgUserSummary[] = [];
      for (const row of rows) {
        const functions = await this.jobFunctions.loadUserFunctionCodes(row.id);
        const client_ids = this.config.staffScopePilotEnabled
          ? await this.userClients.loadClientIdsForUser(row.id)
          : undefined;
        enriched.push({
          ...row,
          job_functions: functions,
          ...(client_ids?.length ? { client_ids } : {}),
        });
      }
      return enriched;
    } catch {
      const roster = await this.staffAuth.listActiveStaff();
      const rows: StaffOrgUserSummary[] = [];
      for (const row of roster.staff) {
        const functions = await this.jobFunctions.loadUserFunctionCodes(row.id);
        rows.push({
          id: row.id,
          email: row.email,
          display_name: row.display_name,
          position_id: row.position_id,
          active: true,
          job_functions: functions,
        });
      }
      return rows;
    }
  }

  async getUser(userRef: string): Promise<StaffOrgUserSummary> {
    const user = await this.resolveUser(userRef);
    const detail = await this.usersRepository.getUserById(user.id);
    if (!detail) throw new NotFoundException({ error: 'user_not_found', ref: userRef });
    const functions = await this.jobFunctions.loadUserFunctionCodes(detail.id);
    return { ...detail, job_functions: functions };
  }

  async getNextInternalCode(): Promise<{ internal_code: string }> {
    try {
      const internal_code = await this.usersRepository.nextInternalCode();
      return { internal_code };
    } catch {
      return { internal_code: 'PTTCN100001' };
    }
  }

  async createUser(
    body: CreateStaffOrgUserBody,
    actorEmail: string,
  ): Promise<CreateStaffOrgUserResponse> {
    const functions = normalizeFunctionCodes(body.functions ?? []);
    const sod = validateJobFunctionAssignment(functions);
    if (sod) {
      throw new ConflictException({ error: 'sod_violation', sod_id: sod.id, message: sod.message });
    }

    const created = await this.usersRepository.createUser(body, actorEmail);
    if (functions.length) {
      await this.jobFunctions.replaceUserFunctions(created.user.id, functions, actorEmail);
    }
    const functionsLoaded = await this.jobFunctions.loadUserFunctionCodes(created.user.id);
    return {
      user: { ...created.user, job_functions: functionsLoaded },
      temp_password: created.temp_password,
    };
  }

  async patchUser(
    userRef: string,
    body: PatchStaffOrgUserBody,
    actorEmail: string,
  ): Promise<StaffOrgUserSummary> {
    const user = await this.resolveUser(userRef);
    const updated = await this.usersRepository.patchUser(user.id, body, actorEmail);
    const functions = await this.jobFunctions.loadUserFunctionCodes(updated.id);
    return { ...updated, job_functions: functions };
  }

  async offboardUser(
    userRef: string,
    body: OffboardStaffOrgUserBody,
    actorEmail: string,
  ): Promise<OffboardStaffOrgUserResponse> {
    const user = await this.resolveUser(userRef);
    const result = await this.usersRepository.offboardUser(user.id, body, actorEmail);
    const functions = await this.jobFunctions.loadUserFunctionCodes(result.user.id);
    return {
      user: { ...result.user, job_functions: functions },
      leads_reassigned: result.leads_reassigned,
    };
  }

  async getUserJobFunctions(userRef: string): Promise<StaffUserJobFunctionsResponse> {
    const user = await this.resolveUser(userRef);
    const functions = await this.jobFunctions.loadUserFunctionCodes(user.id);
    return {
      user_id: user.id,
      email: user.email,
      display_name: user.display_name,
      position_id: user.position_id,
      position_code: user.position_code,
      functions,
    };
  }

  async putUserJobFunctions(
    userRef: string,
    body: PutStaffUserJobFunctionsBody,
    actorEmail: string,
  ): Promise<StaffUserJobFunctionsResponse> {
    const user = await this.resolveUser(userRef);
    const functions = normalizeFunctionCodes(body.functions ?? []);
    const sod = validateJobFunctionAssignment(functions);
    if (sod) {
      throw new ConflictException({ error: 'sod_violation', sod_id: sod.id, message: sod.message });
    }
    await this.jobFunctions.replaceUserFunctions(user.id, functions, actorEmail);
    return this.getUserJobFunctions(user.id);
  }

  async getUserClientScope(userRef: string): Promise<StaffUserClientScopeResponse> {
    const user = await this.resolveUser(userRef);
    const client_ids = await this.userClients.loadClientIdsForUser(user.id);
    return { user_id: user.id, client_ids };
  }

  async putUserClientScope(
    userRef: string,
    body: PutStaffUserClientScopeBody,
    actorEmail: string,
  ): Promise<StaffUserClientScopeResponse> {
    const user = await this.resolveUser(userRef);
    const client_ids = await this.userClients.replaceUserClients(
      user.id,
      body.client_ids ?? [],
      actorEmail,
    );
    return { user_id: user.id, client_ids };
  }

  async importUserClientScopeCsv(
    body: ImportStaffUserClientScopeBody,
    actorEmail: string,
  ): Promise<ImportStaffUserClientScopeResponse> {
    const dryRun = Boolean(body.dry_run);
    const lines = String(body.csv ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const grouped = new Map<string, Set<string>>();
    const errors: string[] = [];

    for (const line of lines) {
      if (/^email\s*,/i.test(line)) continue;
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 2) {
        errors.push(`Invalid row: ${line}`);
        continue;
      }
      const email = parts[0].toLowerCase();
      const clientId = parts[1];
      if (!email.includes('@')) {
        errors.push(`Invalid email: ${parts[0]}`);
        continue;
      }
      if (!UUID_RE.test(clientId)) {
        errors.push(`Invalid client_id for ${email}: ${clientId}`);
        continue;
      }
      const set = grouped.get(email) ?? new Set<string>();
      set.add(clientId);
      grouped.set(email, set);
    }

    const preview: ImportStaffUserClientScopeResponse['preview'] = [];
    let applied = 0;

    for (const [email, clientIds] of grouped.entries()) {
      const client_ids = [...clientIds].sort();
      try {
        const user = await this.resolveUser(email);
        preview.push({ email, client_ids, user_id: user.id });
        if (!dryRun) {
          await this.userClients.replaceUserClients(user.id, client_ids, actorEmail);
          applied += 1;
        }
      } catch {
        preview.push({ email, client_ids, error: 'user_not_found' });
        errors.push(`User not found: ${email}`);
      }
    }

    return {
      ok: errors.length === 0,
      dry_run: dryRun,
      rows: grouped.size,
      applied,
      preview,
      errors,
    };
  }

  async getEffectiveCaps(userRef: string): Promise<StaffUserEffectiveCapsResponse> {
    const user = await this.resolveUser(userRef);
    const job_functions = await this.jobFunctions.loadUserFunctionCodes(user.id);
    const permission_sets = await this.permissionSets.loadUserSetCodes(user.id);
    const baseCaps = await this.staffAuth.loadCaps(user.position_id);
    const functionCaps = await this.jobFunctions.loadCapsForFunctions(job_functions);
    const setCaps = await this.permissionSets.loadCapsForUser(user.id);
    const breakGlassCaps = await this.breakGlass.loadActiveCapsForUser(user.id);
    const map = new Map<string, { section: string; action: string }>();
    for (const cap of baseCaps) {
      map.set(`${cap.section}:${cap.action}`, cap);
    }
    for (const cap of functionCaps) {
      map.set(`${cap.section_id}:${cap.action}`, { section: cap.section_id, action: cap.action });
    }
    for (const cap of setCaps) {
      map.set(`${cap.section_id}:${cap.action}`, { section: cap.section_id, action: cap.action });
    }
    for (const cap of breakGlassCaps) {
      map.set(`${cap.section}:${cap.action}`, { section: cap.section, action: cap.action });
    }
    return {
      user_id: user.id,
      email: user.email,
      display_name: user.display_name,
      position_id: user.position_id,
      position_code: user.position_code,
      job_functions,
      permission_sets,
      caps: [...map.values()].sort((a, b) =>
        `${a.section}:${a.action}`.localeCompare(`${b.section}:${b.action}`, 'vi'),
      ),
    };
  }

  private async resolveUser(userRef: string): Promise<ResolvedUser> {
    const ref = userRef.trim();
    if (!ref) throw new NotFoundException({ error: 'user_not_found' });

    if (UUID_RE.test(ref)) {
      const byUuid = await this.loadStaffUser(`u.id = $1::uuid`, [ref]);
      if (byUuid) return byUuid;
    }

    const numeric = Number(ref);
    if (Number.isFinite(numeric) && numeric > 0) {
      const byCrm = await this.resolveFromCrmStaffId(numeric);
      if (byCrm) return byCrm;
    }

    const byEmail = await this.loadStaffUser(`lower(trim(u.email)) = lower(trim($1))`, [ref]);
    if (byEmail) return byEmail;

    throw new NotFoundException({ error: 'user_not_found', ref });
  }

  private async resolveFromCrmStaffId(crmStaffId: number): Promise<ResolvedUser | null> {
    try {
      const crm = await this.db.query<{ email: string | null }>(
        `SELECT email FROM crm_staff WHERE id = $1 AND active = TRUE LIMIT 1`,
        [crmStaffId],
      );
      const email = crm.rows[0]?.email ? String(crm.rows[0].email).trim() : '';
      if (!email) return null;
      return this.loadStaffUser(`lower(trim(u.email)) = lower(trim($1))`, [email]);
    } catch {
      return null;
    }
  }

  private async loadStaffUser(whereSql: string, params: unknown[]): Promise<ResolvedUser | null> {
    try {
      const result = await this.db.query<{
        id: string;
        email: string;
        display_name: string;
        position_id: number;
        position_code: string | null;
      }>(
        `SELECT u.id::text, u.email, u.display_name, u.position_id, p.code AS position_code
         FROM staff_users u
         LEFT JOIN crm_positions p ON p.id = u.position_id
         WHERE ${whereSql}
         LIMIT 1`,
        params,
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: String(row.id),
        email: String(row.email),
        display_name: String(row.display_name || row.email),
        position_id: Number(row.position_id),
        position_code: row.position_code ? String(row.position_code) : undefined,
      };
    } catch {
      return null;
    }
  }
}
