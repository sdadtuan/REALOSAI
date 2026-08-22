import { Injectable } from '@nestjs/common';
import { pipelineRuntimeFromKeys } from '../sales/sales-pipeline.util';
import { CrmConfigSqliteRepository } from './crm-config-sqlite.repository';
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
import { DEFAULT_SALES_PIPELINE_KEY } from './crm-config.defaults';

@Injectable()
export class CrmConfigService {
  constructor(private readonly repo: CrmConfigSqliteRepository) {}

  listCustomFields(entityType?: string): { fields: CustomFieldDef[] } {
    return { fields: this.repo.listCustomFields(entityType) };
  }

  getCustomField(id: number): CustomFieldDef {
    return this.repo.getCustomField(id);
  }

  createCustomField(body: CreateCustomFieldBody): CustomFieldDef {
    return this.repo.createCustomField(body);
  }

  updateCustomField(id: number, body: UpdateCustomFieldBody): CustomFieldDef {
    return this.repo.updateCustomField(id, body);
  }

  deleteCustomField(id: number): { ok: true; id: number } {
    return this.repo.deleteCustomField(id);
  }

  listSalesPipelineStages(includeInactive?: boolean): { pipeline_key: string; stages: PipelineStageDef[] } {
    const stages = this.repo.listPipelineStages(DEFAULT_SALES_PIPELINE_KEY, includeInactive);
    return { pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages };
  }

  createSalesPipelineStage(body: CreatePipelineStageBody): PipelineStageDef {
    return this.repo.createPipelineStage(DEFAULT_SALES_PIPELINE_KEY, body);
  }

  patchSalesPipelineStage(stageKey: string, body: PatchPipelineStageBody): PipelineStageDef {
    return this.repo.patchPipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey, body);
  }

  deleteSalesPipelineStage(stageKey: string): { ok: true; stage_key: string } {
    return this.repo.deletePipelineStage(DEFAULT_SALES_PIPELINE_KEY, stageKey);
  }

  replaceSalesPipelineStages(body: UpdatePipelineStagesBody): { pipeline_key: string; stages: PipelineStageDef[] } {
    const stages = this.repo.replacePipelineStages(DEFAULT_SALES_PIPELINE_KEY, body);
    return { pipeline_key: DEFAULT_SALES_PIPELINE_KEY, stages };
  }

  getSalesPipelineConfig(): SalesPipelineConfig {
    return this.repo.getSalesPipelineConfig();
  }

  toPipelineRuntime(config: SalesPipelineConfig = this.getSalesPipelineConfig()) {
    return pipelineRuntimeFromKeys(
      config.stage_keys,
      config.labels,
      config.sla_hours,
      config.owner_roles,
      config.terminal_stages,
    );
  }

  listLeadLookups(kind?: LeadLookupKind, activeOnly = false): { options: LeadLookupOption[] } {
    return { options: this.repo.listLeadLookups(kind, activeOnly) };
  }

  createLeadLookup(body: CreateLeadLookupBody): LeadLookupOption {
    return this.repo.createLeadLookup(body);
  }

  updateLeadLookup(id: number, body: UpdateLeadLookupBody): LeadLookupOption {
    return this.repo.updateLeadLookup(id, body);
  }

  deleteLeadLookup(id: number): { ok: true; id: number } {
    return this.repo.deleteLeadLookup(id);
  }
}
