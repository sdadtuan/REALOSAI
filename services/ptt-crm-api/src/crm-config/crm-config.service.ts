import { Injectable } from '@nestjs/common';
import { pipelineRuntimeFromKeys } from '../sales/sales-pipeline.util';
import { CrmConfigPgRepository } from './crm-config-pg.repository';
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
  constructor(private readonly pg: CrmConfigPgRepository) {}

  async listCustomFields(entityType?: string): Promise<{ fields: CustomFieldDef[] }> {
    const fields = await this.pg.listCustomFields(entityType);
    return { fields };
  }

  getCustomField(id: number): Promise<CustomFieldDef> {
    return this.pg.getCustomField(id);
  }

  createCustomField(body: CreateCustomFieldBody): Promise<CustomFieldDef> {
    return this.pg.createCustomField(body);
  }

  updateCustomField(id: number, body: UpdateCustomFieldBody): Promise<CustomFieldDef> {
    return this.pg.updateCustomField(id, body);
  }

  deleteCustomField(id: number): Promise<{ ok: true; id: number }> {
    return this.pg.deleteCustomField(id);
  }

  async listSalesPipelineStages(
    includeInactive?: boolean,
  ): Promise<{ pipeline_key: string; stages: PipelineStageDef[] }> {
    const stages = await this.pg.listPipelineStages(DEFAULT_SALES_PIPELINE_KEY, includeInactive);
    return { pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages };
  }

  createSalesPipelineStage(body: CreatePipelineStageBody): Promise<PipelineStageDef> {
    return this.pg.createPipelineStage(DEFAULT_SALES_PIPELINE_KEY, body);
  }

  patchSalesPipelineStage(
    stageKey: string,
    body: PatchPipelineStageBody,
  ): Promise<PipelineStageDef> {
    return this.pg.patchPipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey, body);
  }

  deleteSalesPipelineStage(stageKey: string): Promise<{ ok: true; stage_key: string }> {
    return this.pg.deletePipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey);
  }

  async replaceSalesPipelineStages(
    body: UpdatePipelineStagesBody,
  ): Promise<{ pipeline_key: string; stages: PipelineStageDef[] }> {
    const stages = await this.pg.replacePipelineStages(DEFAULT_SALES_PIPELINE_KEY, body);
    return { pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages };
  }

  getSalesPipelineConfig(): Promise<SalesPipelineConfig> {
    return this.pg.getSalesPipelineConfig();
  }

  async resolveSalesPipelineConfig(): Promise<SalesPipelineConfig> {
    return this.pg.getSalesPipelineConfig();
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

  async listLeadLookups(
    kind?: LeadLookupKind,
    activeOnly = false,
  ): Promise<{ options: LeadLookupOption[] }> {
    const options = await this.pg.listLeadLookups(kind, activeOnly);
    return { options };
  }

  createLeadLookup(body: CreateLeadLookupBody): Promise<LeadLookupOption> {
    return this.pg.createLeadLookup(body);
  }

  updateLeadLookup(id: number, body: UpdateLeadLookupBody): Promise<LeadLookupOption> {
    return this.pg.updateLeadLookup(id, body);
  }

  deleteLeadLookup(id: number): Promise<{ ok: true; id: number }> {
    return this.pg.deleteLeadLookup(id);
  }
}
