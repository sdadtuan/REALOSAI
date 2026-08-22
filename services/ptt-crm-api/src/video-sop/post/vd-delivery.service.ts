import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { tmpdir } from 'os';
import { AppConfigService } from '../../config/app-config.service';
import { VdAssetRepository } from '../assets/vd-asset.repository';
import { selectMediaOps } from '../adapters/i-media-ops';
import { VdGateRepository } from '../gate/vd-gate.repository';
import { VdPostService } from './vd-post.service';
import { VdProjectRepository } from '../project/vd-project.repository';
import { VdShotRepository } from '../script/vd-shot.repository';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdDeliveryRepository } from './vd-delivery.repository';

export type VdDeliveryView = {
  project_id: number;
  package: {
    id: number;
    zip_storage_key: string;
    file_names_json: string[];
    meta_json: {
      contains_human: boolean;
      ai_disclosure: boolean;
    };
    created_at: string;
  } | null;
  gate4_status: string;
  qc_auto_pass: boolean;
};

function sopFileNames(projectId: number): string[] {
  const prefix = `PTT_VD_${projectId}`;
  return [
    `${prefix}_master.mp4`,
    `${prefix}_proxy.mp4`,
    `${prefix}_package.zip`,
    `${prefix}_readme.txt`,
  ];
}

@Injectable()
export class VdDeliveryService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly gates: VdGateRepository,
    private readonly assets: VdAssetRepository,
    private readonly post: VdPostService,
    private readonly packages: VdDeliveryRepository,
    private readonly shots: VdShotRepository,
  ) {}

  private async requireProject(id: number) {
    const row = await this.projects.getById(id);
    if (!row) throw new Error('vd_project_not_found');
    return row;
  }

  private async assertDeliveryAllowed(projectId: number): Promise<void> {
    const map = await this.gates.getStatusMap(projectId);
    if (map[4] === 'approved') return;
    const pipeline = await this.post.getPipeline(projectId);
    const auto = pipeline.gate4_auto;
    if (auto?.ok && !auto.blocked) return;
    throw new Error('gate4_required');
  }

  private async buildMeta(projectId: number): Promise<{ contains_human: boolean; ai_disclosure: boolean }> {
    const shotRows = await this.shots.listByProjectId(projectId);
    const containsHuman = shotRows.some((row) => row.contains_human);
    return { contains_human: containsHuman, ai_disclosure: true };
  }

  async getDelivery(projectId: number): Promise<VdDeliveryView> {
    assertCinematicEnabled(this.config);
    await this.requireProject(projectId);
    const map = await this.gates.getStatusMap(projectId);
    const pipeline = await this.post.getPipeline(projectId);
    const auto = pipeline.gate4_auto;
    const latest = await this.packages.getLatestByProjectId(projectId);
    return {
      project_id: projectId,
      gate4_status: map[4],
      qc_auto_pass: Boolean(auto?.ok && !auto?.blocked),
      package: latest
        ? {
            id: latest.id,
            zip_storage_key: latest.zip_storage_key,
            file_names_json: latest.file_names_json,
            meta_json: {
              contains_human: Boolean(latest.meta_json.contains_human),
              ai_disclosure: Boolean(latest.meta_json.ai_disclosure),
            },
            created_at: latest.created_at,
          }
        : null,
    };
  }

  async createPackage(projectId: number): Promise<VdDeliveryView['package']> {
    assertCinematicEnabled(this.config);
    await this.requireProject(projectId);
    await this.assertDeliveryAllowed(projectId);

    const masterAssets = await this.assets.listByProjectIdAndKind(projectId, 'master', 1);
    const proxyAssets = await this.assets.listByProjectIdAndKind(projectId, 'proxy', 1);
    const paths = [masterAssets[0]?.storage_key, proxyAssets[0]?.storage_key].filter(
      (p): p is string => Boolean(p),
    );
    const zipKey = join(tmpdir(), `vd-s9-${projectId}-${Date.now()}.zip`);
    const media = selectMediaOps();
    await media.zipEditorPackage(paths, zipKey);

    const fileNames = sopFileNames(projectId);
    const meta = await this.buildMeta(projectId);
    const row = await this.packages.insert({
      project_id: projectId,
      zip_storage_key: zipKey,
      file_names_json: fileNames,
      meta_json: meta,
    });

    return {
      id: row.id,
      zip_storage_key: row.zip_storage_key,
      file_names_json: row.file_names_json,
      meta_json: meta,
      created_at: row.created_at,
    };
  }
}
