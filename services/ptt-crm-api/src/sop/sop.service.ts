import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { SopPgRepository } from './sop-pg.repository';
import { SopSqliteRepository } from './sop-sqlite.repository';
import { CreateSopRunBody, isValidDateYmd } from './sop.types';

@Injectable()
export class SopService {
  constructor(
    private readonly sqlite: SopSqliteRepository,
    private readonly pg: SopPgRepository,
    private readonly config: AppConfigService,
  ) {}

  async listTemplates(includeInactive?: string) {
    const raw = String(includeInactive ?? '').trim().toLowerCase();
    const incl = ['1', 'true', 'yes', 'all'].includes(raw);
    const templates = this.config.crmSopPg
      ? await this.pg.listTemplates(incl)
      : this.sqlite.listTemplates(incl);
    return { templates };
  }

  async getTemplate(id: number) {
    const template = this.config.crmSopPg
      ? await this.pg.getTemplateById(id)
      : this.sqlite.getTemplateById(id);
    if (!template) {
      throw new NotFoundException({ error: 'Không tìm thấy template' });
    }
    const steps = this.config.crmSopPg
      ? await this.pg.listSteps(id)
      : this.sqlite.listSteps(id);
    return { template, steps };
  }

  async listTemplateSteps(id: number) {
    const template = this.config.crmSopPg
      ? await this.pg.getTemplateById(id)
      : this.sqlite.getTemplateById(id);
    if (!template) {
      throw new NotFoundException({ error: 'Không tìm thấy template' });
    }
    return { steps: [] };
  }

  async listRuns(status?: string) {
    let statusFilter = String(status ?? 'active').trim().toLowerCase();
    const repo = this.config.crmSopPg ? this.pg : this.sqlite;
    if (!repo.isValidRunStatus(statusFilter) && statusFilter !== 'all') {
      statusFilter = 'active';
    }
    const runs = this.config.crmSopPg
      ? await this.pg.listRuns(statusFilter)
      : this.sqlite.listRuns(statusFilter);
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
        const exists = this.config.crmSopPg
          ? await this.pg.campaignExists(cid)
          : this.sqlite.campaignExists(cid);
        if (!exists) {
          throw new NotFoundException({ error: 'Chiến dịch không tồn tại' });
        }
      }
    }

    if (body.template_id != null && body.template_id !== 0) {
      const templateId = Number(body.template_id);
      if (Number.isFinite(templateId) && templateId > 0) {
        const tpl = this.config.crmSopPg
          ? await this.pg.getTemplateById(templateId)
          : this.sqlite.getTemplateById(templateId);
        if (!tpl) {
          throw new NotFoundException({ error: 'Template SOP không tồn tại' });
        }
      }
    }

    const generateTasks = body.generate_tasks !== false;
    return this.config.crmSopPg
      ? this.pg.createRun(body, generateTasks)
      : this.sqlite.createRun(body, generateTasks);
  }

  async listOverdueTasks(limit?: string) {
    const raw = String(limit ?? '100').trim();
    const n = Number(raw);
    const cap = Number.isFinite(n) && n > 0 ? n : 100;
    const tasks = this.config.crmSopPg
      ? await this.pg.listOverdueTasks(cap)
      : this.sqlite.listOverdueTasks(cap);
    return {
      overdue_enabled: this.config.sopOverdueEscalate,
      total: tasks.length,
      tasks,
    };
  }
}
