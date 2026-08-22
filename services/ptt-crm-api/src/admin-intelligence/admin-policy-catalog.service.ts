import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { PolicyService } from '../policy/policy.service';
import { AdminIntelligenceRepository } from './admin-intelligence.repository';
import type { AdminPolicyCatalogRow, PatchAdminPolicyBody } from './admin-intelligence.types';

function policiesRoot(): string {
  return join(process.cwd(), '..', '..', 'policies', 'presales');
}

@Injectable()
export class AdminPolicyCatalogService {
  constructor(
    private readonly repo: AdminIntelligenceRepository,
    private readonly policy: PolicyService,
  ) {}

  async syncFromManifest(actorEmail = 'system'): Promise<{ synced: number; bundle_version: string }> {
    const manifestPath = join(policiesRoot(), 'manifest.json');
    const raw = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw) as { version?: string; policies?: string[] };
    const version = String(manifest.version ?? this.policy.bundleVersion());
    const rows = (manifest.policies ?? []).map((policyId) => {
      const slug = policyId.includes('.') ? policyId.split('.').slice(1).join('.') : policyId;
      return {
        policy_id: policyId,
        description: policyId.replace(/\./g, ' — '),
        enabled: true,
        bundle_version: version,
        rego_file: `${slug}.rego`,
      };
    });
    const synced = await this.repo.upsertPolicyCatalog(rows, actorEmail);
    return { synced, bundle_version: version };
  }

  private loadRegoPreview(regoFile: string | null | undefined): string {
    if (!regoFile) return '';
    try {
      return readFileSync(join(policiesRoot(), regoFile), 'utf8');
    } catch {
      return '';
    }
  }

  async listPolicies(): Promise<{ policies: AdminPolicyCatalogRow[]; bundle_version: string }> {
    const rows = await this.repo.listPolicies();
    const policies = rows.map((row) => ({
      ...row,
      rego_preview: this.loadRegoPreview(row.rego_file).slice(0, 500),
    }));
    return { policies, bundle_version: this.policy.bundleVersion() };
  }

  async getPolicy(id: string): Promise<AdminPolicyCatalogRow & { rego_text: string }> {
    const row = await this.repo.getPolicy(id);
    if (!row) throw new NotFoundException({ error: 'policy_not_found', id });
    return {
      ...row,
      rego_preview: this.loadRegoPreview(row.rego_file).slice(0, 500),
      rego_text: this.loadRegoPreview(row.rego_file),
    };
  }

  async patchPolicy(id: string, body: PatchAdminPolicyBody, actorEmail: string): Promise<AdminPolicyCatalogRow> {
    const updated = await this.repo.patchPolicy(id, body, actorEmail);
    if (!updated) throw new NotFoundException({ error: 'policy_not_found', id });
    return {
      ...updated,
      rego_preview: this.loadRegoPreview(updated.rego_file).slice(0, 500),
    };
  }

  async validateBundle(): Promise<{ ok: boolean; bundle_version: string; policy_count: number }> {
    const manifestPath = join(policiesRoot(), 'manifest.json');
    const raw = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw) as { version?: string; policies?: string[] };
    const policies = manifest.policies ?? [];
    if (policies.length < 3) {
      throw new Error(`expected >=3 policies, got ${policies.length}`);
    }
    for (const pid of policies) {
      const slug = pid.includes('.') ? pid.split('.').slice(1).join('.') : pid;
      const regoPath = join(policiesRoot(), `${slug}.rego`);
      readFileSync(regoPath, 'utf8');
    }
    return {
      ok: true,
      bundle_version: String(manifest.version ?? this.policy.bundleVersion()),
      policy_count: policies.length,
    };
  }

  async exportBundleZip(): Promise<{ filename: string; buffer: Buffer }> {
    const manifestPath = join(policiesRoot(), 'manifest.json');
    const manifestRaw = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw) as { version?: string };
    const version = String(manifest.version ?? 'bundle');
    const filename = `opa-bundle-${version}.zip`;

    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
      archive.on('error', reject);
    });

    archive.pipe(stream);
    archive.append(manifestRaw, { name: 'manifest.json' });
    for (const file of ['no_release_without_handoff.rego', 'no_claim_without_mkt_set.rego', 'break_glass_not_expired.rego']) {
      try {
        archive.append(readFileSync(join(policiesRoot(), file), 'utf8'), { name: file });
      } catch {
        // skip missing files in dev
      }
    }
    await archive.finalize();
    const buffer = await done;
    return { filename, buffer };
  }
}
