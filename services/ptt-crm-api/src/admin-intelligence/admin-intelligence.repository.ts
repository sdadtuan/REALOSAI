import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { AppConfigService } from '../config/app-config.service';
import type {
  AdminAiAgentPolicy,
  AdminChangeRequest,
  AdminPolicyCatalogRow,
  ChangeRequestStatus,
  CreateChangeRequestBody,
  CreateLegalEntityBody,
  CreateOrgBranchBody,
  CreateServiceAccountBody,
  EnvDiffResult,
  LegalEntity,
  OrgBranch,
  PatchLegalEntityBody,
  PatchOrgBranchBody,
  PositionUserRow,
  ServiceAccountSummary,
  UpsertAdminAiPolicyBody,
} from './admin-intelligence.types';

function mapPolicy(row: Record<string, unknown>, regoPreview = ''): AdminPolicyCatalogRow {
  return {
    id: String(row.policy_id ?? row.id ?? ''),
    description: String(row.description ?? ''),
    enabled: Boolean(row.enabled ?? true),
    rego_preview: regoPreview,
    bundle_version: String(row.bundle_version ?? ''),
    rego_file: row.rego_file != null ? String(row.rego_file) : null,
    updated_by: row.updated_by != null ? String(row.updated_by) : null,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapChangeRequest(row: Record<string, unknown>): AdminChangeRequest {
  return {
    id: String(row.id),
    kind: String(row.kind ?? 'permission_matrix'),
    entity_key: String(row.entity_key),
    patch_json: (row.patch_json ?? {}) as Record<string, unknown>,
    impact_json: (row.impact_json as Record<string, unknown> | null) ?? null,
    status: String(row.status) as ChangeRequestStatus,
    requester_email: String(row.requester_email),
    approver_email: row.approver_email ? String(row.approver_email) : null,
    approver_note: row.approver_note ? String(row.approver_note) : null,
    applied_at: row.applied_at ? String(row.applied_at) : null,
    created_at: String(row.created_at),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapAiPolicy(row: Record<string, unknown>): AdminAiAgentPolicy {
  return {
    agent_code: String(row.agent_code),
    allowed_tools: Array.isArray(row.allowed_tools) ? row.allowed_tools.map(String) : [],
    spend_cap_usd_monthly: row.spend_cap_usd_monthly != null ? Number(row.spend_cap_usd_monthly) : null,
    pii_block_fields: Array.isArray(row.pii_block_fields) ? row.pii_block_fields.map(String) : [],
    require_human_approval: Boolean(row.require_human_approval),
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapServiceAccount(row: Record<string, unknown>): ServiceAccountSummary {
  const capsRaw = row.scoped_caps;
  let scopedCaps: string[] = [];
  if (Array.isArray(capsRaw)) scopedCaps = capsRaw.map(String);
  else if (typeof capsRaw === 'string') {
    try {
      scopedCaps = (JSON.parse(capsRaw) as unknown[]).map(String);
    } catch {
      scopedCaps = [];
    }
  }
  return {
    id: String(row.id),
    name: String(row.name),
    key_prefix: String(row.key_prefix),
    scoped_caps: scopedCaps,
    active: Boolean(row.active ?? true),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    created_by: String(row.created_by),
    created_at: String(row.created_at),
    last_used_at: row.last_used_at ? String(row.last_used_at) : null,
  };
}

function mapLegalEntity(row: Record<string, unknown>): LegalEntity {
  return {
    id: Number(row.id),
    code: String(row.code),
    name: String(row.name),
    tax_id: row.tax_id ? String(row.tax_id) : null,
    country_code: String(row.country_code ?? 'VN'),
    active: Boolean(row.active ?? true),
  };
}

function mapBranch(row: Record<string, unknown>): OrgBranch {
  return {
    id: Number(row.id),
    legal_entity_id: Number(row.legal_entity_id),
    code: String(row.code),
    name: String(row.name),
    active: Boolean(row.active ?? true),
    legal_entity_code: row.legal_entity_code ? String(row.legal_entity_code) : undefined,
  };
}

@Injectable()
export class AdminIntelligenceRepository implements OnModuleDestroy {
  private pool: Pool | null = null;
  private pgReady: boolean | null = null;

  private memoryPolicies: AdminPolicyCatalogRow[] = [];
  private memoryDiffs: EnvDiffResult[] = [];
  private memoryChanges: AdminChangeRequest[] = [];
  private memoryAiPolicies: AdminAiAgentPolicy[] = [];
  private memoryServiceAccounts: Array<ServiceAccountSummary & { key_hash: string }> = [];
  private memoryLegalEntities: LegalEntity[] = [];
  private memoryBranches: OrgBranch[] = [];

  constructor(private readonly config: AppConfigService) {}

  private get db(): Pool {
    if (!this.pool) {
      this.pool = new Pool({ connectionString: this.config.databaseUrl });
    }
    return this.pool;
  }

  onModuleDestroy(): void {
    void this.pool?.end();
    this.pool = null;
  }

  async ensurePgReady(): Promise<boolean> {
    if (this.pgReady != null) return this.pgReady;
    try {
      await this.db.query(`SELECT 1 FROM admin_policy_catalog LIMIT 1`);
      this.pgReady = true;
    } catch {
      this.pgReady = false;
    }
    return this.pgReady;
  }

  async listActiveUsersByPosition(positionId: number): Promise<PositionUserRow[]> {
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query<{
          id: string;
          email: string;
          display_name: string;
          job_functions: string[] | null;
        }>(
          `SELECT u.id::text, u.email, u.display_name,
                  COALESCE(u.job_functions, '{}') AS job_functions
           FROM staff_users u
           WHERE u.position_id = $1 AND u.active IS TRUE
           ORDER BY u.email
           LIMIT 500`,
          [positionId],
        );
        return result.rows.map((row) => ({
          id: String(row.id),
          email: String(row.email),
          display_name: String(row.display_name || row.email),
          job_functions: Array.isArray(row.job_functions) ? row.job_functions.map(String) : [],
        }));
      } catch {
        return [];
      }
    }
    return [];
  }

  async getPositionCode(positionId: number): Promise<string | null> {
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

  async upsertPolicyCatalog(
    rows: Array<{ policy_id: string; description: string; enabled: boolean; bundle_version: string; rego_file: string }>,
    actorEmail?: string,
  ): Promise<number> {
    let count = 0;
    if (await this.ensurePgReady()) {
      for (const row of rows) {
        await this.db.query(
          `INSERT INTO admin_policy_catalog (policy_id, description, enabled, bundle_version, rego_file, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (policy_id) DO UPDATE SET
             bundle_version = EXCLUDED.bundle_version,
             rego_file = EXCLUDED.rego_file,
             updated_at = NOW()`,
          [row.policy_id, row.description, row.enabled, row.bundle_version, row.rego_file, actorEmail ?? 'system'],
        );
        count += 1;
      }
      return count;
    }
    for (const row of rows) {
      const existing = this.memoryPolicies.find((p) => p.id === row.policy_id);
      const entry = mapPolicy({ ...row, policy_id: row.policy_id }, '');
      if (existing) Object.assign(existing, entry);
      else this.memoryPolicies.push(entry);
      count += 1;
    }
    return count;
  }

  async listPolicies(): Promise<AdminPolicyCatalogRow[]> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT policy_id, description, enabled, bundle_version, rego_file, updated_by, updated_at::text
         FROM admin_policy_catalog
         ORDER BY policy_id`,
      );
      return result.rows.map((row) => mapPolicy(row as Record<string, unknown>));
    }
    return [...this.memoryPolicies];
  }

  async getPolicy(policyId: string): Promise<AdminPolicyCatalogRow | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT policy_id, description, enabled, bundle_version, rego_file, updated_by, updated_at::text
         FROM admin_policy_catalog WHERE policy_id = $1 LIMIT 1`,
        [policyId],
      );
      const row = result.rows[0];
      return row ? mapPolicy(row as Record<string, unknown>) : null;
    }
    return this.memoryPolicies.find((p) => p.id === policyId) ?? null;
  }

  async patchPolicy(
    policyId: string,
    patch: { description?: string; enabled?: boolean },
    actorEmail: string,
  ): Promise<AdminPolicyCatalogRow | null> {
    const sets: string[] = ['updated_at = NOW()', `updated_by = $2`];
    const params: unknown[] = [policyId, actorEmail];
    let idx = 3;
    if (patch.description !== undefined) {
      sets.push(`description = $${idx++}`);
      params.push(String(patch.description));
    }
    if (patch.enabled !== undefined) {
      sets.push(`enabled = $${idx++}`);
      params.push(Boolean(patch.enabled));
    }
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE admin_policy_catalog SET ${sets.join(', ')}
         WHERE policy_id = $1
         RETURNING policy_id, description, enabled, bundle_version, rego_file, updated_by, updated_at::text`,
        params,
      );
      const row = result.rows[0];
      return row ? mapPolicy(row as Record<string, unknown>) : null;
    }
    const existing = this.memoryPolicies.find((p) => p.id === policyId);
    if (!existing) return null;
    if (patch.description !== undefined) existing.description = String(patch.description);
    if (patch.enabled !== undefined) existing.enabled = Boolean(patch.enabled);
    existing.updated_by = actorEmail;
    return existing;
  }

  async listSnapshots(): Promise<
    Array<{ id: number; snapshot_type: string; entity_key: string; signed_at: string; signed_by: string }>
  > {
    try {
      const result = await this.db.query(
        `SELECT id, snapshot_type, entity_key, signed_at::text, signed_by
         FROM admin_config_snapshots
         ORDER BY signed_at DESC
         LIMIT 100`,
      );
      return result.rows.map((row) => ({
        id: Number(row.id),
        snapshot_type: String(row.snapshot_type),
        entity_key: String(row.entity_key),
        signed_at: String(row.signed_at),
        signed_by: String(row.signed_by),
      }));
    } catch {
      return [];
    }
  }

  async getSnapshotPayload(snapshotId: number): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.db.query(
        `SELECT payload_json FROM admin_config_snapshots WHERE id = $1 LIMIT 1`,
        [snapshotId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return (row.payload_json ?? {}) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async saveEnvDiff(
    input: {
      left_snapshot_id?: number | null;
      right_snapshot_id?: number | null;
      left_label: string;
      right_label: string;
      result_json: Record<string, unknown>;
      severity: string;
      created_by: string;
    },
  ): Promise<EnvDiffResult> {
    const resultPayload = input.result_json as EnvDiffResult;
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO admin_env_diff_jobs
           (left_snapshot_id, right_snapshot_id, left_label, right_label, result_json, severity, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         RETURNING id::text, created_at::text`,
        [
          input.left_snapshot_id ?? null,
          input.right_snapshot_id ?? null,
          input.left_label,
          input.right_label,
          JSON.stringify(input.result_json),
          input.severity,
          input.created_by,
        ],
      );
      const row = result.rows[0] as Record<string, unknown>;
      return { ...resultPayload, id: String(row.id), created_at: String(row.created_at) };
    }
    const id = `mem-diff-${Date.now()}`;
    const diff: EnvDiffResult = {
      ...resultPayload,
      id,
      created_at: new Date().toISOString(),
    };
    this.memoryDiffs.unshift(diff);
    return diff;
  }

  async getEnvDiff(id: string): Promise<EnvDiffResult | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, left_label, right_label, result_json, severity, created_at::text
         FROM admin_env_diff_jobs WHERE id = $1::uuid LIMIT 1`,
        [id],
      );
      const row = result.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      const payload = (row.result_json ?? {}) as Record<string, unknown>;
      return {
        ...(payload as Omit<EnvDiffResult, 'id' | 'created_at'>),
        id: String(row.id),
        left_label: String(row.left_label),
        right_label: String(row.right_label),
        severity: String(row.severity) as EnvDiffResult['severity'],
        created_at: String(row.created_at),
      };
    }
    return this.memoryDiffs.find((d) => d.id === id) ?? null;
  }

  async listAiPolicies(): Promise<AdminAiAgentPolicy[]> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT agent_code, allowed_tools, spend_cap_usd_monthly, pii_block_fields,
                require_human_approval, updated_by, updated_at::text
         FROM admin_ai_agent_policies ORDER BY agent_code`,
      );
      return result.rows.map((row) => mapAiPolicy(row as Record<string, unknown>));
    }
    return [...this.memoryAiPolicies];
  }

  async getAiPolicy(agentCode: string): Promise<AdminAiAgentPolicy | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT agent_code, allowed_tools, spend_cap_usd_monthly, pii_block_fields,
                require_human_approval, updated_by, updated_at::text
         FROM admin_ai_agent_policies WHERE agent_code = $1 LIMIT 1`,
        [agentCode],
      );
      const row = result.rows[0];
      return row ? mapAiPolicy(row as Record<string, unknown>) : null;
    }
    return this.memoryAiPolicies.find((p) => p.agent_code === agentCode) ?? null;
  }

  async upsertAiPolicy(agentCode: string, body: UpsertAdminAiPolicyBody, actorEmail: string): Promise<AdminAiAgentPolicy> {
    const allowedTools = body.allowed_tools ?? [];
    const piiFields = body.pii_block_fields ?? [];
    const spendCap = body.spend_cap_usd_monthly ?? null;
    const requireApproval = body.require_human_approval ?? false;

    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO admin_ai_agent_policies
           (agent_code, allowed_tools, spend_cap_usd_monthly, pii_block_fields, require_human_approval, updated_by)
         VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, $6)
         ON CONFLICT (agent_code) DO UPDATE SET
           allowed_tools = EXCLUDED.allowed_tools,
           spend_cap_usd_monthly = EXCLUDED.spend_cap_usd_monthly,
           pii_block_fields = EXCLUDED.pii_block_fields,
           require_human_approval = EXCLUDED.require_human_approval,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
         RETURNING agent_code, allowed_tools, spend_cap_usd_monthly, pii_block_fields,
                   require_human_approval, updated_by, updated_at::text`,
        [
          agentCode,
          JSON.stringify(allowedTools),
          spendCap,
          JSON.stringify(piiFields),
          requireApproval,
          actorEmail,
        ],
      );
      return mapAiPolicy(result.rows[0] as Record<string, unknown>);
    }

    const existing = this.memoryAiPolicies.find((p) => p.agent_code === agentCode);
    const policy: AdminAiAgentPolicy = {
      agent_code: agentCode,
      allowed_tools: allowedTools,
      spend_cap_usd_monthly: spendCap,
      pii_block_fields: piiFields,
      require_human_approval: requireApproval,
      updated_by: actorEmail,
      updated_at: new Date().toISOString(),
    };
    if (existing) Object.assign(existing, policy);
    else this.memoryAiPolicies.push(policy);
    return policy;
  }

  async deleteAiPolicy(agentCode: string): Promise<boolean> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(`DELETE FROM admin_ai_agent_policies WHERE agent_code = $1`, [agentCode]);
      return (result.rowCount ?? 0) > 0;
    }
    const idx = this.memoryAiPolicies.findIndex((p) => p.agent_code === agentCode);
    if (idx < 0) return false;
    this.memoryAiPolicies.splice(idx, 1);
    return true;
  }

  async createChangeRequest(body: CreateChangeRequestBody, requesterEmail: string): Promise<AdminChangeRequest> {
    const kind = body.kind ?? 'permission_matrix';
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO admin_change_requests (kind, entity_key, patch_json, impact_json, requester_email)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
         RETURNING id::text, kind, entity_key, patch_json, impact_json, status, requester_email,
                   approver_email, approver_note, applied_at::text, created_at::text, updated_at::text`,
        [
          kind,
          body.entity_key,
          JSON.stringify(body.patch_json),
          JSON.stringify(body.impact_json ?? null),
          requesterEmail.toLowerCase(),
        ],
      );
      return mapChangeRequest(result.rows[0] as Record<string, unknown>);
    }
    const cr = mapChangeRequest({
      id: `mem-cr-${Date.now()}`,
      kind,
      entity_key: body.entity_key,
      patch_json: body.patch_json,
      impact_json: body.impact_json ?? null,
      status: 'draft',
      requester_email: requesterEmail.toLowerCase(),
      created_at: new Date().toISOString(),
    });
    this.memoryChanges.unshift(cr);
    return cr;
  }

  async listChangeRequests(status?: ChangeRequestStatus): Promise<AdminChangeRequest[]> {
    if (await this.ensurePgReady()) {
      const params: unknown[] = [];
      let where = '';
      if (status) {
        where = 'WHERE status = $1';
        params.push(status);
      }
      const result = await this.db.query(
        `SELECT id::text, kind, entity_key, patch_json, impact_json, status, requester_email,
                approver_email, approver_note, applied_at::text, created_at::text, updated_at::text
         FROM admin_change_requests ${where}
         ORDER BY created_at DESC LIMIT 100`,
        params,
      );
      return result.rows.map((row) => mapChangeRequest(row as Record<string, unknown>));
    }
    return this.memoryChanges.filter((c) => !status || c.status === status);
  }

  async getChangeRequest(id: string): Promise<AdminChangeRequest | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, kind, entity_key, patch_json, impact_json, status, requester_email,
                approver_email, approver_note, applied_at::text, created_at::text, updated_at::text
         FROM admin_change_requests WHERE id = $1::uuid LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      return row ? mapChangeRequest(row as Record<string, unknown>) : null;
    }
    return this.memoryChanges.find((c) => c.id === id) ?? null;
  }

  async updateChangeRequestStatus(
    id: string,
    status: ChangeRequestStatus,
    patch: { approver_email?: string; approver_note?: string; applied_at?: string },
  ): Promise<AdminChangeRequest | null> {
    const sets = ['status = $2', 'updated_at = NOW()'];
    const params: unknown[] = [id, status];
    let idx = 3;
    if (patch.approver_email !== undefined) {
      sets.push(`approver_email = $${idx++}`);
      params.push(patch.approver_email);
    }
    if (patch.approver_note !== undefined) {
      sets.push(`approver_note = $${idx++}`);
      params.push(patch.approver_note);
    }
    if (patch.applied_at !== undefined) {
      sets.push(`applied_at = $${idx++}::timestamptz`);
      params.push(patch.applied_at);
    }
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE admin_change_requests SET ${sets.join(', ')}
         WHERE id = $1::uuid
         RETURNING id::text, kind, entity_key, patch_json, impact_json, status, requester_email,
                   approver_email, approver_note, applied_at::text, created_at::text, updated_at::text`,
        params,
      );
      const row = result.rows[0];
      return row ? mapChangeRequest(row as Record<string, unknown>) : null;
    }
    const existing = this.memoryChanges.find((c) => c.id === id);
    if (!existing) return null;
    existing.status = status;
    if (patch.approver_email !== undefined) existing.approver_email = patch.approver_email;
    if (patch.approver_note !== undefined) existing.approver_note = patch.approver_note;
    if (patch.applied_at !== undefined) existing.applied_at = patch.applied_at;
    return existing;
  }

  async insertServiceAccount(
    input: CreateServiceAccountBody & { key_prefix: string; key_hash: string; created_by: string },
  ): Promise<ServiceAccountSummary> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO staff_service_accounts (name, key_prefix, key_hash, scoped_caps, expires_at, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, $6)
         RETURNING id::text, name, key_prefix, scoped_caps, active, expires_at::text,
                   created_by, created_at::text, last_used_at::text`,
        [
          input.name,
          input.key_prefix,
          input.key_hash,
          JSON.stringify(input.scoped_caps ?? []),
          input.expires_at ?? null,
          input.created_by,
        ],
      );
      return mapServiceAccount(result.rows[0] as Record<string, unknown>);
    }
    const sa = mapServiceAccount({
      id: `mem-sa-${Date.now()}`,
      name: input.name,
      key_prefix: input.key_prefix,
      scoped_caps: input.scoped_caps ?? [],
      active: true,
      expires_at: input.expires_at ?? null,
      created_by: input.created_by,
      created_at: new Date().toISOString(),
    });
    this.memoryServiceAccounts.push({ ...sa, key_hash: input.key_hash });
    return sa;
  }

  async listServiceAccounts(): Promise<ServiceAccountSummary[]> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, name, key_prefix, scoped_caps, active, expires_at::text,
                created_by, created_at::text, last_used_at::text
         FROM staff_service_accounts ORDER BY created_at DESC`,
      );
      return result.rows.map((row) => mapServiceAccount(row as Record<string, unknown>));
    }
    return this.memoryServiceAccounts.map(({ key_hash: _h, ...sa }) => sa);
  }

  async getServiceAccount(id: string): Promise<(ServiceAccountSummary & { key_hash: string }) | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, name, key_prefix, key_hash, scoped_caps, active, expires_at::text,
                created_by, created_at::text, last_used_at::text
         FROM staff_service_accounts WHERE id = $1::uuid LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      if (!row) return null;
      return { ...mapServiceAccount(row as Record<string, unknown>), key_hash: String(row.key_hash) };
    }
    return this.memoryServiceAccounts.find((s) => s.id === id) ?? null;
  }

  async rotateServiceAccountKey(id: string, keyPrefix: string, keyHash: string): Promise<boolean> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE staff_service_accounts SET key_prefix = $2, key_hash = $3 WHERE id = $1::uuid AND active IS TRUE`,
        [id, keyPrefix, keyHash],
      );
      return (result.rowCount ?? 0) > 0;
    }
    const sa = this.memoryServiceAccounts.find((s) => s.id === id);
    if (!sa) return false;
    sa.key_prefix = keyPrefix;
    sa.key_hash = keyHash;
    return true;
  }

  async revokeServiceAccount(id: string): Promise<boolean> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE staff_service_accounts SET active = FALSE WHERE id = $1::uuid`,
        [id],
      );
      return (result.rowCount ?? 0) > 0;
    }
    const sa = this.memoryServiceAccounts.find((s) => s.id === id);
    if (!sa) return false;
    sa.active = false;
    return true;
  }

  async findServiceAccountByKeyHash(keyHash: string): Promise<ServiceAccountSummary | null> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `SELECT id::text, name, key_prefix, scoped_caps, active, expires_at::text,
                created_by, created_at::text, last_used_at::text
         FROM staff_service_accounts
         WHERE key_hash = $1 AND active IS TRUE
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1`,
        [keyHash],
      );
      const row = result.rows[0];
      return row ? mapServiceAccount(row as Record<string, unknown>) : null;
    }
    const sa = this.memoryServiceAccounts.find((s) => s.key_hash === keyHash && s.active);
    if (!sa) return null;
    const { key_hash: _h, ...rest } = sa;
    return rest;
  }

  async listLegalEntities(): Promise<LegalEntity[]> {
    if (await this.ensurePgReady()) {
      try {
        const result = await this.db.query(
          `SELECT id, code, name, tax_id, country_code, active FROM legal_entities ORDER BY code`,
        );
        return result.rows.map((row) => mapLegalEntity(row as Record<string, unknown>));
      } catch {
        return this.memoryLegalEntities;
      }
    }
    return this.memoryLegalEntities;
  }

  async createLegalEntity(body: CreateLegalEntityBody): Promise<LegalEntity> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO legal_entities (code, name, tax_id, country_code)
         VALUES ($1, $2, $3, $4)
         RETURNING id, code, name, tax_id, country_code, active`,
        [body.code.trim(), body.name.trim(), body.tax_id ?? null, body.country_code ?? 'VN'],
      );
      return mapLegalEntity(result.rows[0] as Record<string, unknown>);
    }
    const entity = mapLegalEntity({
      id: this.memoryLegalEntities.length + 1,
      code: body.code,
      name: body.name,
      tax_id: body.tax_id ?? null,
      country_code: body.country_code ?? 'VN',
      active: true,
    });
    this.memoryLegalEntities.push(entity);
    return entity;
  }

  async patchLegalEntity(id: number, body: PatchLegalEntityBody): Promise<LegalEntity | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    if (body.code !== undefined) {
      sets.push(`code = $${idx++}`);
      params.push(body.code.trim());
    }
    if (body.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(body.name.trim());
    }
    if (body.tax_id !== undefined) {
      sets.push(`tax_id = $${idx++}`);
      params.push(body.tax_id);
    }
    if (body.country_code !== undefined) {
      sets.push(`country_code = $${idx++}`);
      params.push(body.country_code);
    }
    if (body.active !== undefined) {
      sets.push(`active = $${idx++}`);
      params.push(body.active);
    }
    params.push(id);
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE legal_entities SET ${sets.join(', ')} WHERE id = $${idx}
         RETURNING id, code, name, tax_id, country_code, active`,
        params,
      );
      const row = result.rows[0];
      return row ? mapLegalEntity(row as Record<string, unknown>) : null;
    }
    const existing = this.memoryLegalEntities.find((e) => e.id === id);
    if (!existing) return null;
    Object.assign(existing, body);
    return existing;
  }

  async listBranches(legalEntityId?: number): Promise<OrgBranch[]> {
    if (await this.ensurePgReady()) {
      try {
        const params: unknown[] = [];
        let where = '';
        if (legalEntityId) {
          where = 'WHERE b.legal_entity_id = $1';
          params.push(legalEntityId);
        }
        const result = await this.db.query(
          `SELECT b.id, b.legal_entity_id, b.code, b.name, b.active, e.code AS legal_entity_code
           FROM org_branches b
           JOIN legal_entities e ON e.id = b.legal_entity_id
           ${where}
           ORDER BY e.code, b.code`,
          params,
        );
        return result.rows.map((row) => mapBranch(row as Record<string, unknown>));
      } catch {
        return this.memoryBranches;
      }
    }
    return this.memoryBranches.filter((b) => !legalEntityId || b.legal_entity_id === legalEntityId);
  }

  async createBranch(body: CreateOrgBranchBody): Promise<OrgBranch> {
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `INSERT INTO org_branches (legal_entity_id, code, name)
         VALUES ($1, $2, $3)
         RETURNING id, legal_entity_id, code, name, active`,
        [body.legal_entity_id, body.code.trim(), body.name.trim()],
      );
      return mapBranch(result.rows[0] as Record<string, unknown>);
    }
    const branch = mapBranch({
      id: this.memoryBranches.length + 1,
      legal_entity_id: body.legal_entity_id,
      code: body.code,
      name: body.name,
      active: true,
    });
    this.memoryBranches.push(branch);
    return branch;
  }

  async patchBranch(id: number, body: PatchOrgBranchBody): Promise<OrgBranch | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;
    if (body.code !== undefined) {
      sets.push(`code = $${idx++}`);
      params.push(body.code.trim());
    }
    if (body.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(body.name.trim());
    }
    if (body.active !== undefined) {
      sets.push(`active = $${idx++}`);
      params.push(body.active);
    }
    params.push(id);
    if (await this.ensurePgReady()) {
      const result = await this.db.query(
        `UPDATE org_branches SET ${sets.join(', ')} WHERE id = $${idx}
         RETURNING id, legal_entity_id, code, name, active`,
        params,
      );
      const row = result.rows[0];
      return row ? mapBranch(row as Record<string, unknown>) : null;
    }
    const existing = this.memoryBranches.find((b) => b.id === id);
    if (!existing) return null;
    Object.assign(existing, body);
    return existing;
  }

  async loadResidencyAllowedTags(userId: string): Promise<string[] | null> {
    try {
      const result = await this.db.query<{ allowed_tags: string[] }>(
        `SELECT allowed_tags FROM staff_user_residency_rules WHERE user_id = $1::uuid LIMIT 1`,
        [userId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return Array.isArray(row.allowed_tags) ? row.allowed_tags.map(String) : null;
    } catch {
      return null;
    }
  }

  async filterClientIdsByResidency(clientIds: string[], allowedTags: string[]): Promise<string[]> {
    if (!clientIds.length || !allowedTags.length) return clientIds;
    try {
      const result = await this.db.query<{ id: string }>(
        `SELECT id::text FROM clients
         WHERE id = ANY($1::uuid[])
           AND (data_residency_tag IS NULL OR data_residency_tag = ANY($2::text[]))`,
        [clientIds, allowedTags],
      );
      return result.rows.map((r) => String(r.id));
    } catch {
      return clientIds;
    }
  }
}
