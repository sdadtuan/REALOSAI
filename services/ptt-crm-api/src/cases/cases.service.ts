import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CasesPgRepository } from './cases-pg.repository';
import {
  CreateCareReportBody,
  CreateCaseEventBody,
  PatchCaseBody,
} from './cases.types';

@Injectable()
export class CasesService {
  constructor(private readonly pg: CasesPgRepository) {}

  async list(q?: string, staffId?: number) {
    const qRaw = String(q ?? '').trim().toLowerCase();
    const cases = await this.pg.listCases(staffId);
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
    const caseRow = await this.pg.getCaseById(id);
    if (!caseRow) {
      throw new NotFoundException({ error: 'Case not found' });
    }
    const events = await this.pg.listEvents(id);
    const careReports = await this.pg.listCareReports(id);
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
      if (!this.pg.isValidStatus(ns)) {
        throw new BadRequestException({ error: 'status không hợp lệ' });
      }
    }
    const updated = await this.pg.patchCase(id, body);
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
    const existing = await this.pg.getCaseById(id);
    if (!existing) {
      throw new NotFoundException({ error: 'Case not found' });
    }
    return this.pg.createEvent(id, text);
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
      return await this.pg.createCareReport(id, body);
    } catch {
      throw new NotFoundException({ error: 'Case not found' });
    }
  }
}
