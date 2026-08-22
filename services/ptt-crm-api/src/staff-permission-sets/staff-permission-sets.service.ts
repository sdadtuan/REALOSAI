import { Injectable, NotFoundException } from '@nestjs/common';
import { StaffPermissionSetsRepository } from './staff-permission-sets.repository';
import type {
  CreateStaffPermissionSetBody,
  PatchStaffPermissionSetBody,
  PutStaffPermissionSetGrantsBody,
  PutStaffUserPermissionSetsBody,
  StaffPermissionSetDetail,
  StaffPermissionSetsListResponse,
  StaffUserPermissionSetsResponse,
} from './staff-permission-sets.types';

@Injectable()
export class StaffPermissionSetsService {
  constructor(private readonly repo: StaffPermissionSetsRepository) {}

  listSets(): Promise<StaffPermissionSetsListResponse> {
    return this.repo.listSets().then((sets) => ({ sets }));
  }

  async getSet(code: string): Promise<StaffPermissionSetDetail> {
    const set = await this.repo.getSetByCode(code);
    if (!set) throw new NotFoundException({ error: 'set_not_found', code });
    return set;
  }

  createSet(body: CreateStaffPermissionSetBody): Promise<StaffPermissionSetDetail> {
    return this.repo.createSet(body);
  }

  patchSet(code: string, body: PatchStaffPermissionSetBody): Promise<StaffPermissionSetDetail> {
    return this.repo.patchSet(code, body);
  }

  replaceGrants(code: string, body: PutStaffPermissionSetGrantsBody): Promise<StaffPermissionSetDetail> {
    return this.repo.replaceGrants(code, body);
  }

  getUserSets(userId: string): Promise<StaffUserPermissionSetsResponse> {
    return this.repo.loadUserSetCodes(userId).then((set_codes) => ({ user_id: userId, set_codes }));
  }

  replaceUserSets(
    userId: string,
    body: PutStaffUserPermissionSetsBody,
    actorEmail: string,
  ): Promise<StaffUserPermissionSetsResponse> {
    return this.repo.replaceUserSets(userId, body.set_codes ?? [], actorEmail);
  }

  loadCapsForUser(userId: string) {
    return this.repo.loadCapsForUser(userId);
  }
}
