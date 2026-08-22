import { Injectable } from '@nestjs/common';
import { AdminAuditRepository } from './admin-audit.repository';
import type { AdminConfigSnapshotRequest } from './admin-audit.types';

@Injectable()
export class AdminConfigSnapshotService {
  constructor(private readonly repo: AdminAuditRepository) {}

  async signSnapshot(actorEmail: string, body: AdminConfigSnapshotRequest, payload: Record<string, unknown>) {
    const id = await this.repo.createSnapshot({
      snapshot_type: body.snapshot_type,
      entity_key: body.entity_key,
      payload_json: payload,
      signed_by: actorEmail,
      note: body.note ?? '',
    });
    await this.repo.logSyntheticEvent({
      event_type: 'config_snapshot_signed',
      actor_email: actorEmail,
      category: 'config_snapshot',
      severity: 'info',
      subject_label: body.entity_key,
      subject_id: body.entity_key,
      action: 'sign_snapshot',
      summary: `Ký snapshot ${body.snapshot_type} — ${body.entity_key}`,
      diff_json: { snapshot_id: id, note: body.note ?? '' },
    });
    return { ok: true, snapshot_id: id };
  }

  async detectDrift(
    snapshotType: string,
    entityKey: string,
    livePayload: Record<string, unknown>,
  ): Promise<{ drift: boolean; snapshot_id?: number; signed_at?: string }> {
    const latest = await this.repo.latestSnapshot(snapshotType, entityKey);
    if (!latest) return { drift: false };
    const drift = JSON.stringify(latest.payload_json) !== JSON.stringify(livePayload);
    if (drift) {
      await this.repo.logSyntheticEvent({
        event_type: 'config_drift_detected',
        actor_email: 'system',
        category: 'config_snapshot',
        severity: 'critical',
        subject_label: entityKey,
        subject_id: entityKey,
        action: 'config_drift',
        summary: `Drift phát hiện — ${entityKey} khác snapshot ${latest.signed_at}`,
        diff_json: {
          snapshot_id: latest.id,
          signed_at: latest.signed_at,
        },
      });
    }
    return { drift, snapshot_id: latest.id, signed_at: latest.signed_at };
  }
}

@Injectable()
export class PiiAccessAuditService {
  constructor(private readonly repo: AdminAuditRepository) {}

  async logLeadPiiView(input: {
    actor_email: string;
    actor_user_id?: string;
    lead_id: number;
    request_path?: string;
  }): Promise<void> {
    await this.repo.logPiiAccess({
      actor_email: input.actor_email,
      actor_user_id: input.actor_user_id,
      resource_type: 'lead',
      resource_id: String(input.lead_id),
      field_path: 'phone,email',
      action: 'view',
      request_path: input.request_path ?? '',
    });
  }
}
