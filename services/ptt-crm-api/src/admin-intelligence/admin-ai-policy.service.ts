import { ForbiddenException, Injectable } from '@nestjs/common';
import { AdminIntelligenceRepository } from './admin-intelligence.repository';
import type { AdminAiAgentPolicy, UpsertAdminAiPolicyBody } from './admin-intelligence.types';

@Injectable()
export class AdminAiPolicyService {
  constructor(private readonly repo: AdminIntelligenceRepository) {}

  list(): Promise<{ policies: AdminAiAgentPolicy[] }> {
    return this.repo.listAiPolicies().then((policies) => ({ policies }));
  }

  get(agentCode: string) {
    return this.repo.getAiPolicy(agentCode);
  }

  upsert(agentCode: string, body: UpsertAdminAiPolicyBody, actorEmail: string) {
    return this.repo.upsertAiPolicy(agentCode, body, actorEmail);
  }

  async remove(agentCode: string) {
    const ok = await this.repo.deleteAiPolicy(agentCode);
    return { ok };
  }

  async assertToolAllowed(agentCode: string, toolId: string): Promise<AdminAiAgentPolicy | null> {
    const policy = await this.repo.getAiPolicy(agentCode);
    if (!policy) return null;
    if (policy.allowed_tools.length && !policy.allowed_tools.includes(toolId)) {
      throw new ForbiddenException({ error: 'ai_tool_denied', agent_code: agentCode, tool_id: toolId });
    }
    return policy;
  }

  isPiiFieldBlocked(policy: AdminAiAgentPolicy | null, field: string): boolean {
    if (!policy) return false;
    return policy.pii_block_fields.includes(field);
  }
}
