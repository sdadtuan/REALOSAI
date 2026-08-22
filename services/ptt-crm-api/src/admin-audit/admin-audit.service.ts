import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminAuditExportService } from './admin-audit-export.service';
import { AdminConfigSnapshotService } from './admin-config-snapshot.service';
import { AdminAuditRepository } from './admin-audit.repository';
import type {
  AdminAuditExportRequest,
  AdminAuditListQuery,
  AdminAuditListResponse,
  AdminConfigSnapshotRequest,
} from './admin-audit.types';

@Injectable()
export class AdminAuditService {
  constructor(
    private readonly repo: AdminAuditRepository,
    private readonly exportService: AdminAuditExportService,
    private readonly snapshots: AdminConfigSnapshotService,
  ) {}

  async listEvents(query: AdminAuditListQuery): Promise<AdminAuditListResponse> {
    const { events, has_more } = await this.repo.listEvents(query);
    return {
      events,
      has_more,
      next_cursor: this.repo.buildNextCursor(events, has_more),
    };
  }

  async getEvent(id: string) {
    const event = await this.repo.getEventById(id);
    if (!event) throw new NotFoundException({ error: 'audit_event_not_found', id });
    return event;
  }

  createExport(actorEmail: string, body: AdminAuditExportRequest) {
    return this.exportService.createJob(actorEmail, body);
  }

  getExportJob(jobId: string) {
    const job = this.exportService.getJob(jobId);
    if (!job) throw new NotFoundException({ error: 'export_job_not_found', job_id: jobId });
    return job;
  }

  signSnapshot(actorEmail: string, body: AdminConfigSnapshotRequest, payload: Record<string, unknown>) {
    return this.snapshots.signSnapshot(actorEmail, body, payload);
  }

  detectMatrixDrift(entityKey: string, liveGrants: Record<string, unknown>) {
    return this.snapshots.detectDrift('permission_matrix', entityKey, liveGrants);
  }
}
