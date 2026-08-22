import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminIntelligenceRepository } from './admin-intelligence.repository';
import type {
  CreateLegalEntityBody,
  CreateOrgBranchBody,
  PatchLegalEntityBody,
  PatchOrgBranchBody,
} from './admin-intelligence.types';

@Injectable()
export class LegalEntityService {
  constructor(private readonly repo: AdminIntelligenceRepository) {}

  listEntities() {
    return this.repo.listLegalEntities().then((entities) => ({ entities }));
  }

  createEntity(body: CreateLegalEntityBody) {
    return this.repo.createLegalEntity(body);
  }

  async patchEntity(id: string, body: PatchLegalEntityBody) {
    const updated = await this.repo.patchLegalEntity(Number(id), body);
    if (!updated) throw new NotFoundException({ error: 'legal_entity_not_found', id });
    return updated;
  }

  listBranches(legalEntityId?: string) {
    const entityId = legalEntityId ? Number(legalEntityId) : undefined;
    return this.repo.listBranches(entityId).then((branches) => ({ branches }));
  }

  createBranch(body: CreateOrgBranchBody) {
    return this.repo.createBranch(body);
  }

  async patchBranch(id: string, body: PatchOrgBranchBody) {
    const updated = await this.repo.patchBranch(Number(id), body);
    if (!updated) throw new NotFoundException({ error: 'branch_not_found', id });
    return updated;
  }
}
