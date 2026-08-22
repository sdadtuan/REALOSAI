import { Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppConfigService } from '../config/app-config.service';
import { ChangeApprovalService } from './change-approval.service';
import type { CompliancePack, CompliancePackPreview } from './admin-intelligence.types';

function packsDir(config: AppConfigService): string {
  void config;
  return join(process.cwd(), 'config', 'compliance-packs');
}

@Injectable()
export class CompliancePackService {
  constructor(
    private readonly config: AppConfigService,
    private readonly changeApproval: ChangeApprovalService,
  ) {}

  listPacks(): { packs: CompliancePack[] } {
    const dir = packsDir(this.config);
    const packs: CompliancePack[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const raw = readFileSync(join(dir, file), 'utf8');
      packs.push(JSON.parse(raw) as CompliancePack);
    }
    return { packs };
  }

  loadPack(code: string): CompliancePack {
    const path = join(packsDir(this.config), `${code}.json`);
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as CompliancePack;
    } catch {
      throw new NotFoundException({ error: 'compliance_pack_not_found', code });
    }
  }

  preview(code: string): CompliancePackPreview {
    const pack = this.loadPack(code);
    const matrixChanges = Object.entries(pack.position_grants).map(([position_code, grants]) => ({
      position_code,
      added: grants.map((g) => `${g.section}.${g.action}`),
      removed: [] as string[],
    }));
    const summary = {
      added: matrixChanges.reduce((n, r) => n + r.added.length, 0),
      removed: 0,
      changed: matrixChanges.length,
    };
    return {
      code: pack.code,
      label: pack.label,
      matrix_changes: matrixChanges,
      permission_sets: pack.permission_sets,
      summary,
    };
  }

  async apply(
    code: string,
    actorEmail: string,
    opts?: { dry_run?: boolean },
  ): Promise<{ ok: boolean; dry_run: boolean; change_request_id?: string }> {
    const pack = this.loadPack(code);
    const dryRun = Boolean(opts?.dry_run);

    if (dryRun) {
      return { ok: true, dry_run: true };
    }

    const requests = [];
    for (const [positionCode, grants] of Object.entries(pack.position_grants)) {
      const grantMap: Record<string, string[]> = {};
      for (const g of grants) {
        if (!grantMap[g.section]) grantMap[g.section] = [];
        if (!grantMap[g.section].includes(g.action)) grantMap[g.section].push(g.action);
      }
      const cr = await this.changeApproval.create(
        {
          kind: 'permission_matrix',
          entity_key: positionCode,
          patch_json: { grants: grantMap, compliance_pack: code },
        },
        actorEmail,
      );
      requests.push(cr.id);
    }

    if (this.changeApproval.approvalRequired()) {
      return { ok: true, dry_run: false, change_request_id: requests[0] };
    }

    return { ok: true, dry_run: false, change_request_id: requests[0] };
  }
}
