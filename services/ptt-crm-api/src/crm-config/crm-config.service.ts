import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { pipelineRuntimeFromKeys } from '../sales/sales-pipeline.util';
import { CrmConfigPgRepository } from './crm-config-pg.repository';
import { CrmConfigSqliteRepository } from './crm-config-sqlite.repository';
import { DEFAULT_SALES_PIPELINE_KEY } from './crm-config.defaults';
import type {
  CreateCustomFieldBody,
  CreateLeadLookupBody,
  CreatePipelineStageBody,
  CustomFieldDef,
  LeadLookupKind,
  LeadLookupOption,
  PatchPipelineStageBody,
  PipelineStageDef,
  SalesPipelineConfig,
  UpdateCustomFieldBody,
  UpdateLeadLookupBody,
  UpdatePipelineStagesBody,
} from './crm-config.types';

@Injectable()
export class CrmConfigService {
  constructor(
    private readonly sqlite: CrmConfigSqliteRepository,
    private readonly pg: CrmConfigPgRepository,
    private readonly config: AppConfigService,
  ) {}

  private get usePg(): boolean {
    return this.config.crmConfigPg;
  }

  listCustomFields(entityType?: string): { fields: CustomFieldDef[] } | Promise<{ fields: CustomFieldDef[] }> {
    return this.usePg
      ? this.pg.listCustomFields(entityType).then((fields) => ({ fields }))
      : { fields: this.sqlite.listCustomFields(entityType) };
  }

  getCustomField(id: number): CustomFieldDef | Promise<CustomFieldDef> {
    return this.usePg ? this.pg.getCustomField(id) : this.sqlite.getCustomField(id);
  }

  createCustomField(body: CreateCustomFieldBody): CustomFieldDef | Promise<CustomFieldDef> {
    return this.usePg ? this.pg.createCustomField(body) : this.sqlite.createCustomField(body);
  }

  updateCustomField(id: number, body: UpdateCustomFieldBody): CustomFieldDef | Promise<CustomFieldDef> {
    return this.usePg ? this.pg.updateCustomField(id, body) : this.sqlite.updateCustomField(id, body);
  }

  deleteCustomField(id: number): { ok: true; id: number } | Promise<{ ok: true; id: number }> {
    return this.usePg ? this.pg.deleteCustomField(id) : this.sqlite.deleteCustomField(id);
  }

  listSalesPipelineStages(
    includeInactive?: boolean,
  ):
    | { pipeline_key: string; stages: PipelineStageDef[] }
    | Promise<{ pipeline_key: string; stages: PipelineStageDef[] }> {
    if (this.usePg) {
      return this.pg
        .listPipelineStages(DEFAULT_SALES_PIPELINE_KEY, includeInactive)
        .then((stages) => ({ pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages }));
    }
    const stages = this.sqlite.listPipelineStages(DEFAULT_SALES_PIPELINE_KEY, includeInactive);
    return { pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages };
  }

  createSalesPipelineStage(body: CreatePipelineStageBody): PipelineStageDef | Promise<PipelineStageDef> {
    return this.usePg
      ? this.pg.createPipelineStage(DEFAULT_SALES_PIPELINE_KEY, body)
      : this.sqlite.createPipelineStage(DEFAULT_SALES_PIPELINE_KEY, body);
  }

  patchSalesPipelineStage(
    stageKey: string,
    body: PatchPipelineStageBody,
  ): PipelineStageDef | Promise<PipelineStageDef> {
    return this.usePg
      ? this.pg.patchPipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey, body)
      : this.sqlite.patchPipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey, body);
  }

  deleteSalesPipelineStage(
    stageKey: string,
  ): { ok: true; stage_key: string } | Promise<{ ok: true; stage_key: string }> {
    return this.usePg
      ? this.pg.deletePipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey)
      : this.sqlite.deletePipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey);
  }

  replaceSalesPipelineStages(
    body: UpdatePipelineStagesBody,
  ):
    | { pipeline_key: string; stages: PipelineStageDef[] }
    | Promise<{ pipeline_key: string; stages: PipelineStageDef[] }> {
    if (this.usePg) {
      return this.pg
        .replacePipelineStages(DEFAULT_SALES_PIPELINE_KEY, body)
        .then((stages) => ({ pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages }));
    }
    const stages = this.sqlite.replacePipelineStages(DEFAULT_SALES_PIPELINE_KEY, body);
    return { pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages };
  }

  getSalesPipelineConfig(): SalesPipelineConfig | Promise<SalesPipelineConfig> {
    return this.usePg ? this.pg.getSalesPipelineConfig() : this.sqlite.getSalesPipelineConfig();
  }

  async resolveSalesPipelineConfig(): Promise<SalesPipelineConfig> {
    return this.usePg
      ? this.pg.getSalesPipelineConfig()
      : this.sqlite.getSalesPipelineConfig();
  }

  toPipelineRuntime(config: SalesPipelineConfig) {
    return pipelineRuntimeFromKeys(
      config.stage_keys,
      config.labels,
      config.sla_hours,
      config.owner_roles,
      config.terminal_stages,
    );
  }

  async resolvePipelineRuntime(config?: SalesPipelineConfig) {
    const resolved = config ?? (await this.resolveSalesPipelineConfig());
    return this.toPipelineRuntime(resolved);
  }

  listLeadLookups(
    kind?: LeadLookupKind,
    activeOnly = false,
  ): { options: LeadLookupOption[] } | Promise<{ options: LeadLookupOption[] }> {
    return this.usePg
      ? this.pg.listLeadLookups(kind, activeOnly).then((options) => ({ options }))
      : { options: this.sqlite.listLeadLookups(kind, activeOnly) };
  }

  createLeadLookup(body: CreateLeadLookupBody): LeadLookupOption | Promise<LeadLookupOption> {
    return this.usePg ? this.pg.createLeadLookup(body) : this.sqlite.createLeadLookup(body);
  }

  updateLeadLookup(id: number, body: UpdateLeadLookupBody): LeadLookupOption | Promise<LeadLookupOption> {
    return this.usePg ? this.pg.updateLeadLookup(id, body) : this.sqlite.updateLeadLookup(id, body);
  }

  deleteLeadLookup(id: number): { ok: true; id: number } | Promise<{ ok: true; id: number }> {
    return this.usePg ? this.pg.deleteLeadLookup(id) : this.sqlite.deleteLeadLookup(id);
  }
}
