import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AdminAuditRepository } from './admin-audit.repository';
import type {
  AdminAuditExportFormat,
  AdminAuditExportJob,
  AdminAuditExportRequest,
  AdminAuditListQuery,
} from './admin-audit.types';

type ExportJobRecord = AdminAuditExportJob & {
  filters: AdminAuditExportRequest;
  payload?: string;
  content_type?: string;
};

@Injectable()
export class AdminAuditExportService {
  private readonly jobs = new Map<string, ExportJobRecord>();

  constructor(private readonly repo: AdminAuditRepository) {}

  async createJob(
    actorEmail: string,
    body: AdminAuditExportRequest,
  ): Promise<AdminAuditExportJob> {
    const jobId = randomUUID();
    const job: ExportJobRecord = {
      job_id: jobId,
      status: 'queued',
      format: body.format,
      created_at: new Date().toISOString(),
      filters: body,
    };
    this.jobs.set(jobId, job);

    void this.runJob(jobId, actorEmail).catch(() => {
      const failed = this.jobs.get(jobId);
      if (failed) {
        failed.status = 'failed';
        failed.error_message = 'export_failed';
        failed.completed_at = new Date().toISOString();
      }
    });

    return {
      job_id: job.job_id,
      status: job.status,
      format: job.format,
      created_at: job.created_at,
    };
  }

  getJob(jobId: string): (AdminAuditExportJob & { download_body?: string; content_type?: string }) | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    return {
      job_id: job.job_id,
      status: job.status,
      format: job.format,
      row_count: job.row_count,
      error_message: job.error_message,
      created_at: job.created_at,
      completed_at: job.completed_at,
      download_body: job.payload,
      content_type: job.content_type,
    };
  }

  private async runJob(jobId: string, actorEmail: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'running';

    const query: AdminAuditListQuery = {
      from: job.filters.from,
      to: job.filters.to,
      actor: job.filters.actor,
      subject: job.filters.subject,
      category: job.filters.category,
      severity: job.filters.severity,
      q: job.filters.q,
      limit: 5000,
    };

    const allEvents = [];
    let cursor: string | undefined;
    for (let i = 0; i < 20; i += 1) {
      const page = await this.repo.listEvents({ ...query, cursor, limit: 500 });
      allEvents.push(...page.events);
      if (!page.has_more || !page.events.length) break;
      cursor = this.repo.buildNextCursor(page.events, page.has_more) ?? undefined;
      if (!cursor) break;
    }

    if (job.format === 'csv') {
      const header = 'created_at,category,severity,actor_email,subject_label,action,summary\n';
      const rows = allEvents
        .map((e) =>
          [
            e.created_at,
            e.category,
            e.severity,
            e.actor_email,
            e.subject_label ?? '',
            e.action,
            e.summary.replace(/"/g, '""'),
          ]
            .map((v) => `"${String(v).replace(/\n/g, ' ')}"`)
            .join(','),
        )
        .join('\n');
      job.payload = header + rows;
      job.content_type = 'text/csv; charset=utf-8';
    } else {
      job.payload = JSON.stringify(
        {
          meta: {
            exported_at: new Date().toISOString(),
            exported_by: actorEmail,
            row_count: allEvents.length,
            filters: job.filters,
          },
          events: allEvents,
        },
        null,
        2,
      );
      job.content_type = 'application/json; charset=utf-8';
    }

    job.row_count = allEvents.length;
    job.status = 'completed';
    job.completed_at = new Date().toISOString();
  }
}
