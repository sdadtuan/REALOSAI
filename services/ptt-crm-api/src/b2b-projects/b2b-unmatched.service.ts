import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { B2bProjectsRepository } from './b2b-projects.repository';
import { webhookChannelToIngress } from './b2b-ingest.util';

@Injectable()
export class B2bUnmatchedService {
  constructor(private readonly repo: B2bProjectsRepository) {}

  async list(input: { limit?: number; since?: string }) {
    const items = await this.repo.listUnmatched(input);
    return { items };
  }

  async mapToProject(input: { id: string; projectId: string; pageId?: string }) {
    const row = await this.repo.getUnmatchedById(input.id);
    if (!row) throw new NotFoundException({ error: 'not_found' });
    const project = await this.repo.getProject(input.projectId);
    if (!project) throw new NotFoundException({ error: 'project_not_found' });

    const ingress = webhookChannelToIngress(row.channel);
    if (ingress === 'facebook') {
      if (!input.pageId) {
        throw new BadRequestException({ error: 'page_id_required' });
      }
      await this.repo.attachFormToProject({
        projectId: input.projectId,
        pageId: input.pageId,
        formId: row.external_key,
      });
    } else if (ingress === 'zalo' || ingress === 'webform' || ingress === 'api') {
      await this.repo.attachChannelAccount({
        projectId: input.projectId,
        channelType: ingress,
        externalKey: row.external_key,
        label: `Mapped ${row.external_key.slice(0, 24)}`,
      });
    } else {
      throw new BadRequestException({ error: 'unsupported_channel' });
    }

    await this.repo.deleteUnmatched(input.id);
    return { ok: true, project_id: input.projectId };
  }
}
