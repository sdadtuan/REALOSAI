import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { LeadMeetingPrepLlmService, type LmpLlmCompleteBody } from './lead-meeting-prep-llm.service';

@Controller('api/v1/internal/lmp')
@UseGuards(StaffOrInternalKeyGuard)
export class LeadMeetingPrepInternalController {
  constructor(private readonly llm: LeadMeetingPrepLlmService) {}

  @Post('llm-complete')
  llmComplete(
    @Body() body: LmpLlmCompleteBody,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.llm.completeSynthesize(body, correlationId ?? null);
  }
}
