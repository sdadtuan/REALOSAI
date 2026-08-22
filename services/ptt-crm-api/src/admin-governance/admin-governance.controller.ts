import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import {
  StaffPermissionsConfigureGuard,
  StaffPermissionsViewGuard,
} from '../staff-permissions/guards/staff-permissions.guard';
import { AccessReviewCampaignService } from './access-review-campaign.service';
import { AdminIntegrationsService } from './admin-integrations.service';
import { GuestAccountExpiryService } from './guest-account-expiry.service';
import { StaleAccountService } from './stale-account.service';
import { AccessReviewCertifyGuard } from './guards/access-review-certify.guard';
import type {
  AccessReviewCampaignStatus,
  AccessReviewItemDecision,
  CreateAccessReviewCampaignBody,
  PatchAccessReviewCampaignBody,
  PatchAccessReviewItemBody,
} from './admin-governance.types';

@Controller('api/v1/admin/governance')
export class AdminGovernanceController {
  constructor(
    private readonly campaigns: AccessReviewCampaignService,
    private readonly stale: StaleAccountService,
    private readonly guestExpiry: GuestAccountExpiryService,
  ) {}

  @Get('access-reviews/campaigns')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listCampaigns(@Query('status') status?: AccessReviewCampaignStatus) {
    return this.campaigns.listCampaigns(status);
  }

  @Post('access-reviews/campaigns')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  createCampaign(@Body() body: CreateAccessReviewCampaignBody, @StaffUser() staff?: StaffJwtPayload) {
    return this.campaigns.createCampaign(body, staff?.email ?? '');
  }

  @Get('access-reviews/campaigns/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  getCampaign(@Param('id') id: string) {
    return this.campaigns.getCampaign(id);
  }

  @Patch('access-reviews/campaigns/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  patchCampaign(
    @Param('id') id: string,
    @Body() body: PatchAccessReviewCampaignBody,
    @StaffUser() staff?: StaffJwtPayload,
  ) {
    return this.campaigns.patchCampaign(id, body, staff?.email ?? '');
  }

  @Post('access-reviews/campaigns/:id/launch')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  launchCampaign(@Param('id') id: string, @StaffUser() staff?: StaffJwtPayload) {
    return this.campaigns.launchCampaign(id, staff?.email ?? '');
  }

  @Post('access-reviews/campaigns/:id/close')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  closeCampaign(
    @Param('id') id: string,
    @Query('force') force?: string,
    @StaffUser() staff?: StaffJwtPayload,
  ) {
    return this.campaigns.closeCampaign(id, staff?.email ?? '', force === '1' || force === 'true');
  }

  @Post('access-reviews/campaigns/:id/cancel')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  cancelCampaign(@Param('id') id: string, @StaffUser() staff?: StaffJwtPayload) {
    return this.campaigns.cancelCampaign(id, staff?.email ?? '');
  }

  @Get('access-reviews/campaigns/:id/items')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listItems(
    @Param('id') id: string,
    @Query('decision') decision?: AccessReviewItemDecision,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.campaigns.listItems(id, {
      decision,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('access-reviews/inbox')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listInbox(@Query('campaign_id') campaignId: string | undefined, @StaffUser() staff?: StaffJwtPayload) {
    return this.campaigns.listInbox(staff?.email ?? '', campaignId);
  }

  @Patch('access-reviews/items/:itemId')
  @UseGuards(StaffOrInternalKeyGuard, AccessReviewCertifyGuard)
  patchItem(
    @Param('itemId') itemId: string,
    @Body() body: PatchAccessReviewItemBody,
    @StaffUser() staff?: StaffJwtPayload,
  ) {
    return this.campaigns.patchItem(itemId, body, staff?.email ?? '');
  }

  @Post('access-reviews/items/bulk')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  bulkPatchItems(@Body() body: { item_ids?: string[]; decision: AccessReviewItemDecision; note?: string }, @StaffUser() staff?: StaffJwtPayload) {
    return this.campaigns.bulkPatchItems(body.item_ids ?? [], body, staff?.email ?? '');
  }

  @Get('stale-accounts')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  listStaleAccounts(
    @Query('inactive_days') inactiveDays?: string,
    @Query('include_never_logged_in') includeNever?: string,
    @Query('admin_only') adminOnly?: string,
  ) {
    return this.stale.listStaleAccounts({
      inactive_days: inactiveDays ? Number(inactiveDays) : undefined,
      include_never_logged_in: includeNever !== '0' && includeNever !== 'false',
      admin_only: adminOnly === '1' || adminOnly === 'true',
    });
  }

  @Post('deactivate-expired-accounts')
  @UseGuards(StaffOrInternalKeyGuard)
  deactivateExpiredAccounts() {
    return this.guestExpiry.deactivateExpired();
  }
}

@Controller('api/v1/admin/integrations')
export class AdminIntegrationsController {
  constructor(private readonly integrations: AdminIntegrationsService) {}

  @Get()
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  list() {
    return this.integrations.listIntegrations();
  }

  @Get('health')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsViewGuard)
  health() {
    return this.integrations.health();
  }

  @Post(':id/rotate-request')
  @UseGuards(StaffOrInternalKeyGuard, StaffPermissionsConfigureGuard)
  rotateRequest(@Param('id') id: string, @StaffUser() staff?: StaffJwtPayload) {
    return this.integrations.rotateRequest(id, staff?.email ?? '');
  }
}
