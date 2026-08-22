import { Controller, Get, Post, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffClientScopeService } from '../staff-client-scope/staff-client-scope.service';
import { StaffScopedRequest } from '../staff-client-scope/staff-client-scope.http.util';
import {
  StaffMetaAdsOpsSubmitGuard,
  StaffMetaAdsOpsViewGuard,
} from './guards/staff-meta-ads-ops.guard';
import { MetaAdsOpsService } from './meta-ads-ops.service';
import type { MetaAdsOpsEditSubmitBody, MetaAdsOpsLaunchBody } from './meta-ads-ops.types';

@Controller('api/v1/meta/ads-ops')
export class MetaAdsOpsController {
  constructor(
    private readonly adsOps: MetaAdsOpsService,
    private readonly clientScope: StaffClientScopeService,
  ) {}

  @Get('templates')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAdsOpsViewGuard)
  templates() {
    return this.adsOps.listTemplates();
  }

  @Get('preflight')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAdsOpsViewGuard)
  async preflight(@Req() req: StaffScopedRequest, @Query('client_id') clientId: string) {
    await this.assertClientScope(req, clientId);
    return this.adsOps.getPreflight(String(clientId ?? '').trim());
  }

  @Post('creative/upload')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAdsOpsSubmitGuard)
  async uploadCreative(
    @Req() req: StaffScopedRequest,
    @Body()
    body: { client_id: string; creative_submission_id: string; external_account_id?: string },
  ) {
    await this.assertClientScope(req, body.client_id);
    return this.adsOps.uploadCreative(body);
  }

  @Post('launch')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAdsOpsSubmitGuard)
  async launch(@Req() req: StaffScopedRequest, @Body() body: MetaAdsOpsLaunchBody) {
    await this.assertClientScope(req, body.client_id);
    return this.adsOps.submitLaunch(body);
  }

  @Get('requests/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAdsOpsViewGuard)
  requestStatus(@Param('id') id: string) {
    return this.adsOps.getRequestStatus(id);
  }

  @Get('deep-link')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAdsOpsViewGuard)
  async deepLink(
    @Req() req: StaffScopedRequest,
    @Query('client_id') clientId: string,
    @Query('external_campaign_id') campaignId?: string,
    @Query('external_ad_id') adId?: string,
  ) {
    await this.assertClientScope(req, clientId);
    return this.adsOps.getDeepLink({
      client_id: clientId,
      external_campaign_id: campaignId,
      external_ad_id: adId,
    });
  }

  @Get('edit/snapshot')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAdsOpsViewGuard)
  async editSnapshot(
    @Req() req: StaffScopedRequest,
    @Query('client_id') clientId: string,
    @Query('external_ad_id') adId: string,
  ) {
    await this.assertClientScope(req, clientId);
    return this.adsOps.getEditSnapshot(String(clientId ?? '').trim(), String(adId ?? '').trim());
  }

  @Get('edit/preflight')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAdsOpsViewGuard)
  async editPreflight(
    @Req() req: StaffScopedRequest,
    @Query('client_id') clientId: string,
    @Query('external_ad_id') adId: string,
    @Query('action') action?: string,
    @Query('creative_submission_id') creativeSubmissionId?: string,
    @Query('disapproved_ack') disapprovedAck?: string,
    @Query('effective_status') effectiveStatus?: string,
  ) {
    await this.assertClientScope(req, clientId);
    return this.adsOps.getEditPreflight({
      client_id: clientId,
      external_ad_id: adId,
      action,
      creative_submission_id: creativeSubmissionId,
      disapproved_ack: disapprovedAck,
      effective_status: effectiveStatus,
    });
  }

  @Post('edit/submit')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAdsOpsSubmitGuard)
  async editSubmit(@Req() req: StaffScopedRequest, @Body() body: MetaAdsOpsEditSubmitBody) {
    await this.assertClientScope(req, body.client_id);
    return this.adsOps.submitEdit(body);
  }

  private async assertClientScope(req: StaffScopedRequest, clientId: string | undefined): Promise<void> {
    const scope = await this.clientScope.resolveForRequest(req);
    this.clientScope.assertClientAccessible(scope, clientId);
  }
}
