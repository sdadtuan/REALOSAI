import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppConfigService } from '../config/app-config.service';
import { evaluateByAction, evaluatePolicy } from './policy.engine';
import {
  POLICY_BUNDLE_VERSION,
  PolicyContext,
  PolicyEvaluateInput,
  PolicyEvaluateResult,
  PolicyId,
  PresalesPolicyPreview,
} from './policy.types';

@Injectable()
export class PolicyService {
  private healthy = true;

  constructor(private readonly config: AppConfigService) {}

  isEnabled(): boolean {
    return this.config.staffPolicyOpaEnabled;
  }

  bundleVersion(): string {
    return POLICY_BUNDLE_VERSION;
  }

  markHealthy(ok = true): void {
    this.healthy = ok;
  }

  assertHealthyForMutate(): void {
    if (this.isEnabled() && !this.healthy) {
      throw new ServiceUnavailableException({
        error: 'policy_service_unavailable',
        message: 'Policy engine unavailable — mutate denied (fail-closed).',
      });
    }
  }

  evaluate(input: PolicyEvaluateInput): PolicyEvaluateResult {
    this.markHealthy(true);
    return evaluatePolicy(input.policy_id, input.context);
  }

  evaluateAction(ctx: PolicyContext): PolicyEvaluateResult {
    this.markHealthy(true);
    return evaluateByAction(ctx);
  }

  assertAllow(ctx: PolicyContext): void {
    if (!this.isEnabled()) return;
    this.assertHealthyForMutate();
    const result = this.evaluateAction(ctx);
    if (!result.allow) {
      throw new ForbiddenException({
        error: 'policy_denied',
        policy_id: result.policy_id,
        reason: result.reason,
        bundle_version: result.bundle_version,
      });
    }
  }

  preview(action: 'release' | 'claim', ctx: Omit<PolicyContext, 'action'>): PresalesPolicyPreview {
    const result = this.evaluateAction({ ...ctx, action });
    return {
      action,
      allowed: result.allow,
      policy_id: result.allow ? undefined : result.policy_id,
      reason: result.reason,
      bundle_version: result.bundle_version,
    };
  }

  loadManifestVersion(): string {
    try {
      const manifestPath = join(process.cwd(), '..', '..', 'policies', 'presales', 'manifest.json');
      const raw = readFileSync(manifestPath, 'utf8');
      const parsed = JSON.parse(raw) as { version?: string };
      return String(parsed.version ?? POLICY_BUNDLE_VERSION);
    } catch {
      return POLICY_BUNDLE_VERSION;
    }
  }
}
