import { BadRequestException, Injectable } from '@nestjs/common';
import { LEAD_IO_MAX_EXPORT, LEAD_IO_MAX_IMPORT_ROWS } from './leads-io.constants';
import {
  buildLeadImportTemplateXlsx,
  buildLeadsExportXlsx,
  exportFilename,
  parseLeadImportXlsx,
  templateFilename,
} from './leads-io.util';
import { LeadsService } from './leads.service';
import { LeadsWriteService } from './leads-write.service';
import { B2bLeadScopeService } from '../b2b-projects/b2b-lead-scope.service';
import { CreateLeadV1Body, LeadV1, ListLeadsQuery } from './leads.types';
import { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { CapChecker, serializeLeadsForCaps } from '../staff-permissions/field-level.serializer';

export interface LeadExportQuery extends ListLeadsQuery {
  ids?: number[];
  b2b_export_actor?: {
    staffId: number;
    caps: StaffSectionCap[];
    positionCode?: string | null;
  };
}

export interface LeadImportResult {
  ok: boolean;
  created: number;
  skipped: number;
  leads: LeadV1[];
  errors: Array<{ row: number; message: string }>;
}

@Injectable()
export class LeadsIoService {
  constructor(
    private readonly leadsService: LeadsService,
    private readonly leadsWrite: LeadsWriteService,
    private readonly b2bScope: B2bLeadScopeService,
  ) {}

  async buildTemplate(): Promise<{ buffer: Buffer; filename: string }> {
    return {
      buffer: await buildLeadImportTemplateXlsx(),
      filename: templateFilename(),
    };
  }

  async exportXlsx(
    query: LeadExportQuery,
    caps?: StaffSectionCap[],
    hasCap?: CapChecker,
  ): Promise<{ buffer: Buffer; filename: string; count: number }> {
    let leads = await this.collectLeadsForExport(query);
    if (caps?.length && hasCap) {
      leads = serializeLeadsForCaps(leads, caps, hasCap, { exportMode: true });
    }
    const queryParts: string[] = [];
    if (query.q) queryParts.push(`Tìm: ${query.q}`);
    if (query.status) queryParts.push(`Trạng thái: ${query.status}`);
    if (query.source) queryParts.push(`Nguồn: ${query.source}`);
    if (query.channel) queryParts.push(`Kênh: ${query.channel}`);
    if (query.ids?.length) queryParts.push(`Chọn: ${query.ids.length} lead`);

    const buffer = await buildLeadsExportXlsx(leads, {
      exportedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      queryLabel: queryParts.length ? queryParts.join(' · ') : `Tổng ${leads.length} lead`,
    });

    return {
      buffer,
      filename: exportFilename(query.ids?.length ? 'leads-selected' : 'leads-export'),
      count: leads.length,
    };
  }

  async importXlsx(file: Express.Multer.File | undefined): Promise<LeadImportResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ error: 'Thiếu file Excel (.xlsx)' });
    }
    const name = String(file.originalname ?? '').toLowerCase();
    if (!name.endsWith('.xlsx')) {
      throw new BadRequestException({ error: 'Chỉ hỗ trợ file .xlsx' });
    }

    const parsed = await parseLeadImportXlsx(file.buffer);
    if (parsed.rows.length > LEAD_IO_MAX_IMPORT_ROWS) {
      throw new BadRequestException({
        error: `Tối đa ${LEAD_IO_MAX_IMPORT_ROWS} dòng mỗi lần import`,
      });
    }

    const leads: LeadV1[] = [];
    const errors = [...parsed.errors];

    for (const item of parsed.rows) {
      try {
        leads.push(await this.leadsWrite.createLead(item.body));
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err && 'message' in err
              ? String((err as { message?: unknown }).message)
              : 'Import thất bại';
        errors.push({ row: item.rowNumber, message });
      }
    }

    return {
      ok: errors.length === 0,
      created: leads.length,
      skipped: errors.length,
      leads,
      errors,
    };
  }

  private async collectLeadsForExport(query: LeadExportQuery): Promise<LeadV1[]> {
    if (query.ids?.length) {
      const uniqueIds = [...new Set(query.ids.filter((id) => Number.isFinite(id) && id > 0))];
      const leads: LeadV1[] = [];
      for (const id of uniqueIds) {
        const lead = await this.leadsService.getLead(id);
        if (!lead) continue;
        if (query.allowed_client_ids?.length) {
          const cid = String(lead.client_id ?? '').trim();
          if (!cid || !query.allowed_client_ids.includes(cid)) continue;
        }
        if (query.b2b_export_actor) {
          try {
            await this.b2bScope.assertLeadVisible({
              ...query.b2b_export_actor,
              lead: {
                owner_id: lead.owner_id,
                client_id: lead.client_id,
                channel: lead.channel,
                source: lead.source,
                status: lead.status,
                b2b_project_id: lead.b2b_project_id,
                meta_json: { lead_flow_kind: lead.lead_flow_kind },
              },
            });
          } catch {
            continue;
          }
        }
        leads.push(lead);
      }
      return leads;
    }

    const out: LeadV1[] = [];
    let offset = 0;
    const pageSize = 200;
    while (out.length < LEAD_IO_MAX_EXPORT) {
      const page = await this.leadsService.listLeads({
        ...query,
        limit: pageSize,
        offset,
      });
      out.push(...page.leads);
      if (page.leads.length === 0 || out.length >= page.total) break;
      offset += pageSize;
    }
    return out.slice(0, LEAD_IO_MAX_EXPORT);
  }
}
