import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffPermissionsConfigureGuard,
  StaffPermissionsViewGuard,
} from '../staff-permissions/guards/staff-permissions.guard';
import { AdminAiPolicyService } from './admin-ai-policy.service';
import { AdminPolicyCatalogService } from './admin-policy-catalog.service';
import { ChangeApprovalService } from './change-approval.service';
import { CompliancePackService } from './compliance-pack.service';
import { EnvironmentDiffService } from './environment-diff.service';
import { LegalEntityService } from './legal-entity.service';
import { PolicyImpactService } from './policy-impact.service';
import { ServiceAccountService } from './service-account.service';
import { DelegatedAdminGuard, RequireAdminScope } from './guards/delegated-admin.guard';
import type {
  ChangeRequestStatus,
  CreateChangeRequestBody,
  CreateEnvDiffBody,
  CreateLegalEntityBody,
  CreateOrgBranchBody,
  CreateServiceAccountBody,
  PatchAdminPolicyBody,
  PatchLegalEntityBody,
  PatchOrgBranchBody,
  RejectChangeRequestBody,
  SimulateMatrixImpactBody,
  UpsertAdminAiPolicyBody,
} from './admin-intelligence.types';

@Controller('api/v1/admin')
export class AdminIntelligenceController {
  constructor(
    private readonly policyImpact: PolicyImpactService,
    private readonly policyCatalog: AdminPolicyCatalogService,
    private readonly envDiff: EnvironmentDiffService,
    private readonly aiPolicy: AdminAiPolicyService,
    private readonly changeApproval: ChangeApprovalService,
    private readonly compliancePacks: CompliancePackService,
    private readonly serviceAccounts: ServiceAccountService,
    private readonly legalEntities: LegalEntityService,
  ) {}

  @Post('policy/simulate-impact')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('rbac')
  simulateImpact(@Body() body: SimulateMatrixImpactBody, @StaffUser() staff?: StaffJwtPayload) {
    return this.policyImpact.simulateImpact(body, staff?.email ?? '');
  }

  @Get('policies')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  listPolicies() {
    return this.policyCatalog.listPolicies();
  }

  @Post('policies/sync')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  syncPolicies(@StaffUser() staff?: StaffJwtPayload) {
    return this.policyCatalog.syncFromManifest(staff?.email ?? 'system');
  }

  @Get('policies/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  getPolicy(@Param('id') id: string) {
    return this.policyCatalog.getPolicy(id);
  }

  @Patch('policies/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  patchPolicy(
    @Param('id') id: string,
    @Body() body: PatchAdminPolicyBody,
    @StaffUser() staff?: StaffJwtPayload,
  ) {
    return this.policyCatalog.patchPolicy(id, body, staff?.email ?? '');
  }

  @Post('policies/export-bundle')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  async exportBundle(@Res() res: Response) {
    const { filename, buffer } = await this.policyCatalog.exportBundleZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('policies/validate')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  validatePolicies() {
    return this.policyCatalog.validateBundle();
  }

  @Get('environments/snapshots')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  listSnapshots() {
    return this.envDiff.listSnapshots();
  }

  @Post('environments/diff')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  createDiff(@Body() body: CreateEnvDiffBody, @StaffUser() staff?: StaffJwtPayload) {
    return this.envDiff.createDiff(body, staff?.email ?? '');
  }

  @Get('environments/diff/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  getDiff(@Param('id') id: string) {
    return this.envDiff.getDiff(id);
  }

  @Get('ai/policies')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  listAiPolicies() {
    return this.aiPolicy.list();
  }

  @Get('ai/policies/:agentCode')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  getAiPolicy(@Param('agentCode') agentCode: string) {
    return this.aiPolicy.get(agentCode);
  }

  @Post('ai/policies/:agentCode')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  upsertAiPolicy(
    @Param('agentCode') agentCode: string,
    @Body() body: UpsertAdminAiPolicyBody,
    @StaffUser() staff?: StaffJwtPayload,
  ) {
    return this.aiPolicy.upsert(agentCode, body, staff?.email ?? '');
  }

  @Patch('ai/policies/:agentCode')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  patchAiPolicy(
    @Param('agentCode') agentCode: string,
    @Body() body: UpsertAdminAiPolicyBody,
    @StaffUser() staff?: StaffJwtPayload,
  ) {
    return this.aiPolicy.upsert(agentCode, body, staff?.email ?? '');
  }

  @Delete('ai/policies/:agentCode')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  deleteAiPolicy(@Param('agentCode') agentCode: string) {
    return this.aiPolicy.remove(agentCode);
  }

  @Post('change-requests')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('rbac')
  createChangeRequest(@Body() body: CreateChangeRequestBody, @StaffUser() staff?: StaffJwtPayload) {
    return this.changeApproval.create(body, staff?.email ?? '');
  }

  @Get('change-requests')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  listChangeRequests(@Query('status') status?: ChangeRequestStatus) {
    return this.changeApproval.list(status);
  }

  @Get('change-requests/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  getChangeRequest(@Param('id') id: string) {
    return this.changeApproval.get(id);
  }

  @Post('change-requests/:id/submit')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('rbac')
  submitChangeRequest(@Param('id') id: string, @StaffUser() staff?: StaffJwtPayload) {
    return this.changeApproval.submit(id, staff?.email ?? '');
  }

  @Post('change-requests/:id/approve')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  approveChangeRequest(@Param('id') id: string, @StaffUser() staff?: StaffJwtPayload) {
    return this.changeApproval.approve(id, staff?.email ?? '', staff);
  }

  @Post('change-requests/:id/reject')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  rejectChangeRequest(
    @Param('id') id: string,
    @Body() body: RejectChangeRequestBody,
    @StaffUser() staff?: StaffJwtPayload,
  ) {
    return this.changeApproval.reject(id, staff?.email ?? '', body, staff);
  }

  @Get('compliance-packs')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  listCompliancePacks() {
    return this.compliancePacks.listPacks();
  }

  @Get('compliance-packs/:code/preview')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  previewCompliancePack(@Param('code') code: string) {
    return this.compliancePacks.preview(code);
  }

  @Post('compliance-packs/:code/apply')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  applyCompliancePack(
    @Param('code') code: string,
    @Query('dry_run') dryRun?: string,
    @StaffUser() staff?: StaffJwtPayload,
  ) {
    return this.compliancePacks.apply(code, staff?.email ?? '', {
      dry_run: dryRun === '1' || dryRun === 'true',
    });
  }

  @Get('service-accounts')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  listServiceAccounts() {
    return this.serviceAccounts.list();
  }

  @Post('service-accounts')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  createServiceAccount(@Body() body: CreateServiceAccountBody, @StaffUser() staff?: StaffJwtPayload) {
    return this.serviceAccounts.create(body, staff?.email ?? '');
  }

  @Post('service-accounts/:id/rotate')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  rotateServiceAccount(@Param('id') id: string, @StaffUser() staff?: StaffJwtPayload) {
    return this.serviceAccounts.rotate(id, staff?.email ?? '');
  }

  @Delete('service-accounts/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('policy')
  revokeServiceAccount(@Param('id') id: string, @StaffUser() staff?: StaffJwtPayload) {
    return this.serviceAccounts.revoke(id, staff?.email ?? '');
  }

  @Get('org/legal-entities')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('org')
  listLegalEntities() {
    return this.legalEntities.listEntities();
  }

  @Post('org/legal-entities')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('org')
  createLegalEntity(@Body() body: CreateLegalEntityBody) {
    return this.legalEntities.createEntity(body);
  }

  @Patch('org/legal-entities/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('org')
  patchLegalEntity(@Param('id') id: string, @Body() body: PatchLegalEntityBody) {
    return this.legalEntities.patchEntity(id, body);
  }

  @Get('org/branches')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard, DelegatedAdminGuard)
  @RequireAdminScope('org')
  listBranches(@Query('legal_entity_id') legalEntityId?: string) {
    return this.legalEntities.listBranches(legalEntityId);
  }

  @Post('org/branches')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('org')
  createBranch(@Body() body: CreateOrgBranchBody) {
    return this.legalEntities.createBranch(body);
  }

  @Patch('org/branches/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard, DelegatedAdminGuard)
  @RequireAdminScope('org')
  patchBranch(@Param('id') id: string, @Body() body: PatchOrgBranchBody) {
    return this.legalEntities.patchBranch(id, body);
  }
}
