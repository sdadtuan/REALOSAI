import { Injectable } from '@nestjs/common';
import { B2bCommissionLedgerService } from '../b2b-projects/b2b-commission-ledger.service';
import { SopAutoStartService } from '../sop/sop-auto-start.service';
import { LeadsContractPgRepository } from './leads-contract-pg.repository';
import type {
  ContractReadiness,
  ContractRow,
  ContractApprovalRow,
  CreateContractBody,
  PatchContractBody,
} from './contract.types';

@Injectable()
export class LeadsContractService {
  constructor(
    private readonly pgRepo: LeadsContractPgRepository,
    private readonly sopAutoStart: SopAutoStartService,
    private readonly b2bCommissionLedger: B2bCommissionLedgerService,
  ) {}

  getReadiness(leadId: number): Promise<ContractReadiness> {
    return this.pgRepo.getReadiness(leadId);
  }

  async getContractForLead(leadId: number): Promise<{ contract: ContractRow | null; approval: ContractApprovalRow | null }> {
    return this.pgRepo.getContractForLead(leadId);
  }

  createDraft(leadId: number, body: CreateContractBody, actor: string): Promise<ContractRow> {
    return this.pgRepo.createDraftContract(leadId, body, actor);
  }

  patchContract(contractId: number, leadId: number, body: PatchContractBody): Promise<ContractRow> {
    return this.pgRepo.patchContract(contractId, leadId, body);
  }

  submit(contractId: number, leadId: number, actor: string, notes: string): Promise<ContractApprovalRow> {
    return this.pgRepo.submitForApproval(contractId, leadId, actor, notes);
  }

  async listPendingApprovals(limit?: number) {
    const approvals = await this.pgRepo.listPendingApprovals(limit ?? 50);
    return { approvals };
  }

  async listByClient(clientId: string, limit?: number) {
    const contracts = await this.pgRepo.listContractsByClient(clientId, limit ?? 50);
    return { contracts };
  }

  reject(approvalId: number, actor: string, decisionNotes: string): Promise<ContractApprovalRow> {
    return this.pgRepo.rejectApproval(approvalId, actor, decisionNotes);
  }

  async approve(approvalId: number, actor: string) {
    const result = await this.pgRepo.approveAndPromote(approvalId, actor);
    await this.b2bCommissionLedger.postOnContractActive({
      leadId: Number(result.contract.lead_id),
      contractId: Number(result.contract.id),
      amountVnd: Number(result.contract.amount_vnd ?? 0),
    });
    const sop = await this.sopAutoStart.maybeStartOnLifecyclePromote({
      lifecycleId: result.lifecycle_id,
      contractId: result.contract.id,
      serviceSlug: result.contract.service_slug ?? '',
    });
    return { ...result, sop_auto_start: sop };
  }
}
