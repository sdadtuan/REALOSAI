import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { VdAssetRepository } from '../assets/vd-asset.repository';
import { VdGateRepository } from '../gate/vd-gate.repository';
import { VdProjectRepository } from '../project/vd-project.repository';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdReviewRepository } from './vd-review.repository';

const MAX_TTL_DAYS = 14;

export type VdReviewLinkView = {
  id: number;
  token: string;
  project_id: number;
  gate_no: number;
  asset_ids: number[];
  expires_at: string;
  watermark_label: string;
  portal_path: string;
};

export type VdPublicReviewView = {
  token: string;
  project_id: number;
  gate_no: number;
  expires_at: string;
  watermark_label: string;
  watermark_text: string;
  video_url: string;
  asset_ids: number[];
  comments: Array<{
    id: number;
    body: string;
    timecode_ms: number | null;
    pin_x: number | null;
    pin_y: number | null;
    created_at: string;
  }>;
};

function makeToken(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex').slice(0, 48);
}

@Injectable()
export class VdReviewService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly assets: VdAssetRepository,
    private readonly gates: VdGateRepository,
    private readonly reviews: VdReviewRepository,
  ) {}

  private async requireProject(id: number) {
    const row = await this.projects.getById(id);
    if (!row) throw new Error('vd_project_not_found');
    return row;
  }

  private assertNotExpired(expiresAt: string): void {
    if (Date.now() > new Date(expiresAt).getTime()) {
      throw new Error('review_expired');
    }
  }

  async createLink(body: Record<string, unknown>): Promise<VdReviewLinkView> {
    assertCinematicEnabled(this.config);
    const projectId = Number(body.project_id);
    if (!Number.isFinite(projectId) || projectId <= 0) throw new Error('invalid_body');
    const gateNo = Number(body.gate_no);
    if (gateNo !== 1 && gateNo !== 4) throw new Error('invalid_body');
    const ttlDays = Number(body.ttl_days ?? 14);
    if (!Number.isFinite(ttlDays) || ttlDays <= 0 || ttlDays > MAX_TTL_DAYS) {
      throw new Error('ttl_exceeded');
    }
    const assetIdsRaw = body.asset_ids;
    const assetIds = Array.isArray(assetIdsRaw)
      ? assetIdsRaw.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0)
      : [];
    if (assetIds.length === 0) throw new Error('invalid_body');

    await this.requireProject(projectId);
    for (const assetId of assetIds) {
      const asset = await this.assets.getById(assetId);
      if (!asset || asset.project_id !== projectId) throw new Error('invalid_body');
    }

    const watermark =
      typeof body.watermark_label === 'string' && body.watermark_label.trim()
        ? body.watermark_label.trim()
        : 'PTT Review';
    const token = makeToken();
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const row = await this.reviews.insertLink({
      token,
      project_id: projectId,
      gate_no: gateNo,
      asset_ids: assetIds,
      expires_at: expiresAt,
      watermark_label: watermark,
    });

    return {
      id: row.id,
      token: row.token,
      project_id: row.project_id,
      gate_no: row.gate_no,
      asset_ids: row.asset_ids,
      expires_at: row.expires_at,
      watermark_label: row.watermark_label,
      portal_path: `/video-review/${row.token}`,
    };
  }

  async getPublicReview(token: string): Promise<VdPublicReviewView> {
    assertCinematicEnabled(this.config);
    const link = await this.reviews.getByToken(token);
    if (!link) throw new Error('review_not_found');
    this.assertNotExpired(link.expires_at);

    const primaryAsset = link.asset_ids[0];
    const asset = primaryAsset ? await this.assets.getById(primaryAsset) : null;
    const videoUrl = asset?.url || asset?.storage_key || '';
    const watermarkText = `${link.watermark_label} ${new Date().toISOString()}`;
    const comments = await this.reviews.listComments(link.id);

    return {
      token: link.token,
      project_id: link.project_id,
      gate_no: link.gate_no,
      expires_at: link.expires_at,
      watermark_label: link.watermark_label,
      watermark_text: watermarkText,
      video_url: videoUrl,
      asset_ids: link.asset_ids,
      comments: comments.map((row) => ({
        id: row.id,
        body: row.body,
        timecode_ms: row.timecode_ms,
        pin_x: row.pin_x,
        pin_y: row.pin_y,
        created_at: row.created_at,
      })),
    };
  }

  async addComment(token: string, body: Record<string, unknown>) {
    const link = await this.reviews.getByToken(token);
    if (!link) throw new Error('review_not_found');
    this.assertNotExpired(link.expires_at);
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!text) throw new Error('invalid_body');
    const timecodeMs =
      body.timecode_ms != null && Number.isFinite(Number(body.timecode_ms))
        ? Number(body.timecode_ms)
        : null;
    const pinX =
      body.pin_x != null && Number.isFinite(Number(body.pin_x)) ? Number(body.pin_x) : null;
    const pinY =
      body.pin_y != null && Number.isFinite(Number(body.pin_y)) ? Number(body.pin_y) : null;
    return this.reviews.insertComment({
      link_id: link.id,
      body: text,
      timecode_ms: timecodeMs,
      pin_x: pinX,
      pin_y: pinY,
    });
  }

  async approveFromPortal(token: string): Promise<{ ok: true; gate_no: number }> {
    const link = await this.reviews.getByToken(token);
    if (!link) throw new Error('review_not_found');
    this.assertNotExpired(link.expires_at);
    await this.gates.updateStatus(link.project_id, link.gate_no, 'approved');
    return { ok: true, gate_no: link.gate_no };
  }

  async requestChangesFromPortal(token: string, body: Record<string, unknown>) {
    const link = await this.reviews.getByToken(token);
    if (!link) throw new Error('review_not_found');
    this.assertNotExpired(link.expires_at);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : 'Client request changes';
    await this.gates.updateStatus(link.project_id, link.gate_no, 'rejected');
    await this.gates.insertRework({
      project_id: link.project_id,
      gate_no: link.gate_no,
      reason,
    });
    return { ok: true, gate_no: link.gate_no };
  }
}
