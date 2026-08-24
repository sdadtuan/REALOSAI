import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { SopPgRepository } from './sop-pg.repository';
import { CreateSopRunBody, isValidDateYmd } from './sop.types';

@Injectable()
export class SopService {
  constructor(
    private readonly pg: SopPgRepository,
    private readonly config: AppConfigService,
  ) {}

  async listTemplates(includeInactive?: string) {
    const raw = String(includeInactive ?? '').trim().toLowerCase();
    const incl = ['1', 'true', 'yes', 'all'].includes(raw);
    const templates = await this.pg.listTemplates(incl);
    return { templates };
  }

  async getTemplate(id: number) {
    const template = await this.pg.getTemplateById(id);
    if (!template) {
      throw new NotFoundException({ error: 'Không tìm thấy template' });
    }
    const steps = await this.pg.listSteps(id);
    return { template, steps };
  }

  async listTemplateSteps(id: number) {
    const template = await this.pg.getTemplateById(id);
    if (!template) {
      throw new NotFoundException({ error: 'Không tìm thấy template' });
    }
    return { steps: [] };
  }

  async listRuns(status?: string) {
    let statusFilter = String(status ?? 'active').trim().toLowerCase();
    if (!this.pg.isValidRunStatus(statusFilter) && statusFilter !== 'all') {
      statusFilter = 'active';
    }
    const runs = await this.pg.listRuns(statusFilter);
    return { runs };
  }

  async createRun(body: CreateSopRunBody) {
    const name = String(body.name ?? '').trim();
    if (!name) {
      throw new BadRequestException({ error: 'Thiếu tên SOP Run' });
    }
    const startDate = String(body.start_date ?? '').trim();
    if (startDate && !isValidDateYmd(startDate)) {
      throw new BadRequestException({ error: 'start_date phải YYYY-MM-DD' });
    }

    if (body.campaign_id != null && body.campaign_id !== 0) {
      const cid = Number(body.campaign_id);
      if (Number.isFinite(cid) && cid > 0) {
        const exists = await this.pg.campaignExists(cid);
        if (!exists) {
          throw new NotFoundException({ error: 'Chiến dịch không tồn tại' });
        }
      }
    }

    if (body.template_id != null && body.template_id !== 0) {
      const templateId = Number(body.template_id);
      if (Number.isFinite(templateId) && templateId > 0) {
        const tpl = await this.pg.getTemplateById(templateId);
        if (!tpl) {
          throw new NotFoundException({ error: 'Template SOP không tồn tại' });
        }
      }
    }

    const generateTasks = body.generate_tasks !== false;
    return this.pg.createRun(body, generateTasks);
  }

  async listOverdueTasks(limit?: string) {
    const raw = String(limit ?? '100').trim();
    const n = Number(raw);
    const cap = Number.isFinite(n) && n > 0 ? n : 100;
    const tasks = await this.pg.listOverdueTasks(cap);
    return {
      overdue_enabled: this.config.sopOverdueEscalate,
      total: tasks.length,
      tasks,
    };
  }
}
