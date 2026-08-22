import { buildDiscoveryAnswersPatch, type DiscoveryChecklistState } from '@/lib/crm/intake-discovery';
import { buildRedFlagsPatch, type IntakeRedFlagsState } from '@/lib/crm/intake-red-flags';

export function buildIntakeAnswersPatch(input: {
  existing: Record<string, unknown> | undefined;
  need: string;
  discovery: DiscoveryChecklistState;
  redFlags: IntakeRedFlagsState;
}): Record<string, unknown> {
  const withDiscovery = buildDiscoveryAnswersPatch(input.existing, input.need, input.discovery);
  return buildRedFlagsPatch(withDiscovery, input.redFlags);
}
