import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { BdsPackGuard } from '../guards/bds-pack.guard';
import { BdsProjectOsGuard } from '../guards/bds-project-os.guard';
import {
  type LayoutInput,
  type LegalDocUpsert,
  type MilestoneInput,
  type PhaseInput,
  type TowerInput,
  type ZoneInput,
} from './bds-project-os.repository';
import { BdsProjectOsService } from './bds-project-os.service';

@Controller('api/v1/bds')
@UseGuards(StaffOrInternalKeyGuard, BdsPackGuard, BdsProjectOsGuard)
export class BdsProjectOsController {
  constructor(private readonly projectOs: BdsProjectOsService) {}

  @Get('projects/:id/towers')
  listTowers(@Param('id', ParseIntPipe) id: number, @Headers('x-bds-tenant') tenantId?: string) {
    return this.projectOs.listTowers(id, tenantId);
  }

  @Post('projects/:id/towers')
  createTower(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TowerInput,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.projectOs.createTower(id, body, tenantId);
  }

  @Get('projects/:id/zones')
  listZones(@Param('id', ParseIntPipe) id: number, @Headers('x-bds-tenant') tenantId?: string) {
    return this.projectOs.listZones(id, tenantId);
  }

  @Post('projects/:id/zones')
  createZone(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ZoneInput,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.projectOs.createZone(id, body, tenantId);
  }

  @Get('projects/:id/layouts')
  listLayouts(@Param('id', ParseIntPipe) id: number, @Headers('x-bds-tenant') tenantId?: string) {
    return this.projectOs.listLayouts(id, tenantId);
  }

  @Post('projects/:id/layouts')
  createLayout(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: LayoutInput,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.projectOs.createLayout(id, body, tenantId);
  }

  @Get('projects/:id/legal-docs')
  listLegalDocs(@Param('id', ParseIntPipe) id: number, @Headers('x-bds-tenant') tenantId?: string) {
    return this.projectOs.listLegalDocs(id, tenantId);
  }

  @Post('projects/:id/legal-docs')
  upsertLegalDoc(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: LegalDocUpsert,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.projectOs.upsertLegalDoc(id, body, tenantId);
  }

  @Post('projects/:id/legal-gate')
  openLegalGate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { override?: boolean; reason?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.projectOs.openLegalGate(id, body ?? {}, new Date(), tenantId);
  }

  @Get('projects/:id/phases')
  listPhases(@Param('id', ParseIntPipe) id: number, @Headers('x-bds-tenant') tenantId?: string) {
    return this.projectOs.listPhases(id, tenantId);
  }

  @Post('projects/:id/phases')
  createPhase(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: PhaseInput,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.projectOs.createPhase(id, body, tenantId);
  }

  @Post('phases/:id/open')
  @HttpCode(200)
  openPhase(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.projectOs.openPhase(id, tenantId);
  }

  @Post('phases/:id/close')
  @HttpCode(200)
  closePhase(@Param('id') id: string, @Headers('x-bds-tenant') tenantId?: string) {
    return this.projectOs.closePhase(id, tenantId);
  }

  @Get('projects/:id/milestones')
  listMilestones(@Param('id', ParseIntPipe) id: number, @Headers('x-bds-tenant') tenantId?: string) {
    return this.projectOs.listMilestones(id, tenantId);
  }

  @Post('projects/:id/milestones')
  createMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: MilestoneInput,
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.projectOs.createMilestone(id, body, tenantId);
  }

  @Post('milestones/:id/reach')
  @HttpCode(200)
  markMilestoneReached(
    @Param('id') id: string,
    @Body() body: { actual_date?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    const actualDate = String(body?.actual_date ?? '').trim() || new Date().toISOString().slice(0, 10);
    return this.projectOs.markMilestoneReached(id, actualDate, tenantId);
  }

  @Get('projects/:id/plan-revisions')
  listRevisions(@Param('id', ParseIntPipe) id: number, @Headers('x-bds-tenant') tenantId?: string) {
    return this.projectOs.listRevisions(id, tenantId);
  }

  @Post('projects/:id/plan-revisions')
  createRevision(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { kind?: string; body_json?: unknown; tenant_id?: string | null },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.projectOs.createRevision(
      id,
      { kind: String(body?.kind ?? ''), body_json: body?.body_json, tenant_id: body?.tenant_id },
      tenantId,
    );
  }

  @Post('plan-revisions/:id/approve')
  @HttpCode(200)
  approveRevision(
    @Param('id') id: string,
    @Body() body: { reviewed_by?: string },
    @Headers('x-bds-tenant') tenantId?: string,
  ) {
    return this.projectOs.approveRevision(id, String(body?.reviewed_by ?? ''), tenantId);
  }
}
