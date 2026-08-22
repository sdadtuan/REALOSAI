import { BadRequestException, Injectable } from '@nestjs/common';
import { CatalogPgRepository } from './catalog-pg.repository';
import {
  AssignScopeRow,
  CatalogIndustryRow,
  CatalogPublicPayload,
  CatalogServiceRow,
  CreateAssignScopeBody,
  CreateCatalogIndustryBody,
  CreateCatalogServiceBody,
  PatchAssignScopeBody,
  PatchCatalogIndustryBody,
  PatchCatalogServiceBody,
  StaffOption,
} from './catalog.types';

@Injectable()
export class CatalogService {
  constructor(private readonly repo: CatalogPgRepository) {}

  private async wrap<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException({ error: message });
    }
  }

  publicPayload(): Promise<CatalogPublicPayload> {
    return this.wrap(() => this.repo.publicPayload());
  }

  listServices(): Promise<CatalogServiceRow[]> {
    return this.wrap(() => this.repo.listServices(false));
  }

  listIndustries(): Promise<CatalogIndustryRow[]> {
    return this.wrap(() => this.repo.listIndustries(false));
  }

  createService(body: CreateCatalogServiceBody): Promise<CatalogServiceRow> {
    return this.wrap(() => this.repo.createService(body));
  }

  updateService(id: number, body: PatchCatalogServiceBody): Promise<CatalogServiceRow> {
    return this.wrap(() => this.repo.updateService(id, body));
  }

  createIndustry(body: CreateCatalogIndustryBody): Promise<CatalogIndustryRow> {
    return this.wrap(() => this.repo.createIndustry(body));
  }

  updateIndustry(id: number, body: PatchCatalogIndustryBody): Promise<CatalogIndustryRow> {
    return this.wrap(() => this.repo.updateIndustry(id, body));
  }

  listAssignScopes(): Promise<{ scopes: AssignScopeRow[]; staff: StaffOption[] }> {
    return this.wrap(() => this.repo.listAssignScopes());
  }

  createAssignScope(body: CreateAssignScopeBody): Promise<AssignScopeRow> {
    return this.wrap(() => this.repo.createAssignScope(body));
  }

  updateAssignScope(id: number, body: PatchAssignScopeBody): Promise<AssignScopeRow> {
    return this.wrap(() => this.repo.updateAssignScope(id, body));
  }

  deleteAssignScope(id: number): Promise<void> {
    return this.wrap(() => this.repo.deleteAssignScope(id));
  }
}
