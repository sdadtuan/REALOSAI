import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentMarketingRepository } from '../../content-marketing/content-marketing.repository';
import type { CmktMediaJson } from '../../content-marketing/content-marketing.types';
import {
  assertStudioWritable,
  lockVideoStudio,
} from '../../content-marketing/video-social/social-studio.util';
import type { VdProjectRow } from '../video-sop.types';
import { VdProjectService } from './vd-project.service';

const HTTP_400 = new Set([
  'studio_locked',
  'cmkt_cinematic_disabled',
  'video_cinematic_daily_cap',
  'vd_tables_missing',
  'stage_guard',
  'invalid_body',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_project_not_found' || msg === 'cmkt_item_not_found') {
    throw new NotFoundException({ error: msg, message: msg });
  }
  if (HTTP_400.has(msg)) {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Injectable()
export class VdProjectHttpService {
  constructor(
    private readonly projects: VdProjectService,
    private readonly cmkt: ContentMarketingRepository,
  ) {}

  async create(body: Record<string, unknown>, email: string): Promise<VdProjectRow> {
    const lifecycleId = Number(body.lifecycle_id);
    const itemId = Number(body.cmkt_item_id);
    if (!Number.isFinite(lifecycleId) || lifecycleId <= 0 || !Number.isFinite(itemId) || itemId <= 0) {
      throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
    }

    const item = await this.cmkt.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'cmkt_item_not_found', message: 'cmkt_item_not_found' });
    }

    try {
      assertStudioWritable(item.media_json ?? {}, 'cinematic');
    } catch (err) {
      mapKnownError(err);
    }

    const title =
      typeof body.title === 'string' && body.title.trim() ? body.title.trim() : item.title;
    const scriptMarkdown =
      typeof item.body_json?.markdown === 'string' ? item.body_json.markdown : '';

    let row: VdProjectRow;
    try {
      row = await this.projects.createFromContentItem({
        lifecycleId,
        itemId,
        title,
        scriptMarkdown,
        email,
      });
    } catch (err) {
      mapKnownError(err);
    }

    const media: CmktMediaJson = {
      ...lockVideoStudio(item.media_json ?? {}, 'cinematic'),
      vd_project_id: row.id,
    };
    await this.cmkt.patchItem(lifecycleId, itemId, { media_json: media });
    return row;
  }

  list(lifecycleId: number): Promise<VdProjectRow[]> {
    return this.projects.listByLifecycle(lifecycleId);
  }

  async get(id: number): Promise<VdProjectRow> {
    try {
      return await this.projects.getById(id);
    } catch (err) {
      mapKnownError(err);
    }
  }
}
