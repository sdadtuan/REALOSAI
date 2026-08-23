import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CasesPgRepository } from './cases-pg.repository';
import { CasesSqliteRepository } from './cases-sqlite.repository';
import {
  CreateCareReportBody,
  CreateCaseEventBody,
  PatchCaseBody,
} from './cases.types';

@Injectable()
export class CasesService {
  constructor(
    private readonly sqlite: CasesSqliteRepository,
    private readonly pg: CasesPgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmCasesPg;
  }

  async list(q?: string, staffId?: number) {
    const qRaw = String(q ?? '').trim().toLowerCase();
    const cases = this.usePg
      ? await this.pg.listCases(staffId)
      : this.sqlite.listCases(staffId);
    const filtered = qRaw
      ? cases.filter((c) => {
          const hay = [
            c.title,
            c.description,
            c.assigned_to,
            c.customer_name,
            c.customer_phone,
            c.customer_email,
            c.customer_company,
          ]
            .map((v) => String(v ?? '').toLowerCase())
            .join(' ');
          return hay.includes(qRaw);
        })
      : cases;
    return { cases: filtered, staff_id: staffId ?? null };
  }

  async detail(id: number) {
    const caseRow = this.usePg
      ? await this.pg.getCaseById(id)
      : this.sqlite.getCaseById(id);
    if (!caseRow) {
      throw new NotFoundException({ error: 'Case not found' });
    }
    const events = this.usePg
      ? await this.pg.listEvents(id)
      : this.sqlite.listEvents(id);
    const careReports = this.usePg
      ? await this.pg.listCareReports(id)
      : this.sqlite.listCareReports(id);
    return {
      ...caseRow,
      events,
      care_reports: careReports,
      last_care_report: careReports[0] ?? null,
    };
  }

  async patch(id: number, body: PatchCaseBody) {
    if ('status' in body && body.status != null) {
      const ns = String(body.status).trim();
      const valid = this.usePg
        ? this.pg.isValidStatus(ns)
        : this.sqlite.isValidStatus(ns);
      if (!valid) {
        throw new BadRequestException({ error: 'status không hợp lệ' });
      }
    }
    const updated = this.usePg
      ? await this.pg.patchCase(id, body)
      : this.sqlite.patchCase(id, body);
    if (!updated) {
      throw new NotFoundException({ error: 'Case not found' });
    }
    return updated;
  }

  async addEvent(id: number, body: CreateCaseEventBody) {
    const text = String(body.body ?? '').trim();
    if (!text) {
      throw new BadRequestException({ error: 'Nội dung ghi chú không được để trống' });
    }
    if (text.length > 8000) {
      throw new BadRequestException({ error: 'Ghi chú quá dài' });
    }
    const existing = this.usePg
      ? await this.pg.getCaseById(id)
      : this.sqlite.getCaseById(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Case not found' });
    }
    return this.usePg
      ? this.pg.createEvent(id, text)
      : this.sqlite.createEvent(id, text);
  }

  async addCareReport(id: number, body: CreateCareReportBody) {
    const summary = String(body.summary ?? '').trim();
    if (!summary) {
      throw new BadRequestException({ error: 'Nội dung báo cáo không được để trống' });
    }
    if (summary.length > 4000) {
      throw new BadRequestException({ error: 'Báo cáo quá dài' });
    }
    try {
      return this.usePg
        ? await this.pg.createCareReport(id, body)
        : this.sqlite.createCareReport(id, body);
    } catch {
      throw new NotFoundException({ error: 'Case not found' });
    }
  }
}
