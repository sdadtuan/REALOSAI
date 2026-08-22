import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { StaffUser } from '../staff-auth/staff-jwt.guard';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffProposalsWriteGuard } from '../proposals/guards/staff-proposals.guard';
import { StaffLmpRunGuard, StaffLmpViewGuard } from './guards/staff-lmp.guard';
import { LeadMeetingPrepEnabledGuard } from './guards/lead-meeting-prep-enabled.guard';
import type {
  LeadMeetingPrepDebriefBody,
  LeadMeetingPrepCallDebriefBody,
  LeadMeetingPrepFeedbackBody,
  RunLeadMeetingPrepBody,
  SelectEntityBody,
} from './lead-meeting-prep.types';
import { LeadMeetingPrepService } from './lead-meeting-prep.service';

@Controller('api/v1/leads')
@UseGuards(LeadMeetingPrepEnabledGuard)
export class LeadMeetingPrepController {
  constructor(private readonly prep: LeadMeetingPrepService) {}

  @Get(':id/meeting-prep')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpViewGuard)
  getMeetingPrep(@Param('id', ParseIntPipe) id: number) {
    return this.prep.getMeetingPrep(id);
  }

  @Post(':id/meeting-prep/run')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpRunGuard)
  runMeetingPrep(@Param('id', ParseIntPipe) id: number, @Body() body: RunLeadMeetingPrepBody) {
    return this.prep.runMeetingPrep(id, body ?? {});
  }

  @Post(':id/meeting-prep/prepare-close')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpRunGuard)
  prepareClose(@Param('id', ParseIntPipe) id: number) {
    return this.prep.prepareClose(id);
  }

  @Post(':id/meeting-prep/select-entity')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpRunGuard)
  selectEntity(@Param('id', ParseIntPipe) id: number, @Body() body: SelectEntityBody) {
    return this.prep.selectEntity(id, body);
  }

  @Post(':id/meeting-prep/feedback')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpViewGuard)
  submitFeedback(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: LeadMeetingPrepFeedbackBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.prep.submitFeedback(id, body ?? { helpful: false }, staffUser?.email ?? '');
  }

  @Get(':id/meeting-prep/deal-room-slice')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpViewGuard)
  getDealRoomSlice(@Param('id', ParseIntPipe) id: number) {
    return this.prep.getDealRoomSlice(id);
  }

  @Post(':id/meeting-prep/apply-offer-ladder')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpRunGuard, StaffProposalsWriteGuard)
  applyOfferLadder(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { gdkd_override?: boolean },
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.prep.applyOfferLadder(id, {
      gdkdOverride: Boolean(body?.gdkd_override),
      actorPositionId: staffUser?.position_id,
    });
  }

  @Post(':id/meeting-prep/call-debrief')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpViewGuard)
  submitCallDebrief(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: LeadMeetingPrepCallDebriefBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.prep.submitCallDebrief(id, body ?? {}, staffUser?.email ?? '');
  }

  @Post(':id/meeting-prep/debrief')
  @UseGuards(StaffOrInternalKeyGuard, StaffLmpViewGuard)
  submitDebrief(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: LeadMeetingPrepDebriefBody,
    @StaffUser() staffUser?: StaffJwtPayload,
  ) {
    return this.prep.submitDebrief(id, body ?? {}, staffUser?.email ?? '');
  }
}
