import { BadRequestException, Injectable } from '@nestjs/common';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import { StaffOrgService } from '../staff-org/staff-org.service';
import { StaffAccessReviewActionsRepository } from './staff-access-review-actions.repository';
import { StaffRbacAuditRepository } from './staff-rbac-audit.repository';
import { capsToStrings } from './staff-nav-preview.util';

export interface AccessReviewCsvRow {
  user_email: string;
  action: string;
  note?: string;
}

@Injectable()
export class StaffPermissionsAccessReviewService {
  constructor(
    private readonly org: StaffOrgService,
    private readonly audit: StaffRbacAuditRepository,
    private readonly actions: StaffAccessReviewActionsRepository,
  ) {}

  async buildZip(quarter: string): Promise<{ buffer: Buffer; filename: string }> {
    const q = quarter.trim() || 'current';
    const users = await this.org.listUsers({ includeInactive: true });
    const events = await this.audit.listForAccessReview(q);

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

    archive.append(
      JSON.stringify(
        {
          quarter: q,
          generated_at: new Date().toISOString(),
          user_count: users.length,
          event_count: events.length,
        },
        null,
        2,
      ),
      { name: 'manifest.json' },
    );

    archive.append(JSON.stringify(events, null, 2), { name: 'rbac-events.json' });

    for (const user of users) {
      let effective;
      try {
        effective = await this.org.getEffectiveCaps(user.id);
      } catch {
        effective = { caps: [], job_functions: [], permission_sets: [] };
      }
      const md = [
        `# Access review — ${user.display_name}`,
        '',
        `- Email: ${user.email}`,
        `- User ID: ${user.id}`,
        `- Position: ${effective.position_code ?? effective.position_id}`,
        `- Job functions: ${(effective.job_functions ?? []).join(', ') || '—'}`,
        `- Permission sets: ${(effective.permission_sets ?? []).join(', ') || '—'}`,
        '',
        '## Effective caps',
        '',
        ...capsToStrings(
          (effective.caps ?? []).map((c) => ({ section: c.section, action: c.action })),
        ).map((line) => `- ${line}`),
      ].join('\n');
      const safeName = user.email.replace(/[^a-zA-Z0-9._-]+/g, '_');
      archive.append(md, { name: `users/${safeName}.md` });
      archive.append(JSON.stringify(effective, null, 2), { name: `users/${safeName}.json` });
    }

    await archive.finalize();
    const buffer = await done;
    return { buffer, filename: `access-review-${q}.zip` };
  }

  /** PO tick CSV → audit log + revoke stub (WIN-4-D). */
  async applyCsv(
    quarter: string,
    rows: AccessReviewCsvRow[],
    actorEmail: string,
  ): Promise<{ ok: true; applied: number; revoke_stub: number; actions: unknown[] }> {
    const q = quarter.trim() || 'current';
    if (!rows?.length) {
      throw new BadRequestException({ error: 'rows_required' });
    }
    const normalized = rows
      .map((r) => ({
        user_email: String(r.user_email ?? '').trim().toLowerCase(),
        action: String(r.action ?? '').trim().toLowerCase(),
        note: String(r.note ?? '').trim(),
      }))
      .filter((r) => r.user_email && r.action);
    if (!normalized.length) {
      throw new BadRequestException({ error: 'no_valid_rows' });
    }

    const inserted = await this.actions.insertMany(q, normalized, actorEmail);
    const revokeStub = inserted.filter((r) => r.action === 'revoke').length;

    return {
      ok: true,
      applied: inserted.length,
      revoke_stub: revokeStub,
      actions: inserted,
    };
  }

  async listAppliedActions(quarter: string) {
    const q = quarter.trim() || 'current';
    const actions = await this.actions.listForQuarter(q);
    return { ok: true, quarter: q, actions };
  }
}
