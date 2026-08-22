import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { PolicyService } from './policy.service';
import { PolicyContext, PolicyEvaluateInput, PolicyEvaluateResult, PolicyId } from './policy.types';

@Controller('api/v1/policy')
export class PolicyController {
  constructor(private readonly policy: PolicyService) {}

  /** Internal/debug — evaluate policy bundle (WIN-4-C §9.3). */
  @Post('evaluate')
  @UseGuards(StaffOrInternalKeyGuard)
  evaluate(@Body() body: PolicyEvaluateInput): PolicyEvaluateResult {
    const policyId = String(body.policy_id ?? '').trim() as PolicyId;
    const context = (body.context ?? {}) as PolicyContext;
    return this.policy.evaluate({ policy_id: policyId, context });
  }
}
