import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { B2bCommissionLedgerService } from '../b2b-projects/b2b-commission-ledger.service';
import { SopAutoStartService } from '../sop/sop-auto-start.service';
import { LeadsContractPgRepository } from './leads-contract-pg.repository';
import { LeadsContractSqliteRepository } from './leads-contract-sqlite.repository';
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
    private readonly sqliteRepo: LeadsContractSqliteRepository,
    private readonly pgRepo: LeadsContractPgRepository,
    private readonly config: AppConfigService,
    private readonly sopAutoStart: SopAutoStartService,
    private readonly b2bCommissionLedger: B2bCommissionLedgerService,
  ) {}

  private get usePgContract(): boolean {
    return this.config.crmContractPg;
  }

  getReadiness(leadId: number): Promise<ContractReadiness> {
    return this.usePgContract ? this.pgRepo.getReadiness(leadId) : this.sqliteRepo.getReadiness(leadId);
  }

  async getContractForLead(leadId: number): Promise<{ contract: ContractRow | null; approval: ContractApprovalRow | null }> {
    return this.usePgContract ? this.pgRepo.getContractForLead(leadId) : this.sqliteRepo.getContractForLead(leadId);
  }

  createDraft(leadId: number, body: CreateContractBody, actor: string): Promise<ContractRow> {
    return this.usePgContract
      ? this.pgRepo.createDraftContract(leadId, body, actor)
      : this.sqliteRepo.createDraftContract(leadId, body, actor);
  }

  patchContract(contractId: number, leadId: number, body: PatchContractBody): Promise<ContractRow> {
    return this.usePgContract
      ? this.pgRepo.patchContract(contractId, leadId, body)
      : Promise.resolve(this.sqliteRepo.patchContract(contractId, leadId, body));
  }

  submit(contractId: number, leadId: number, actor: string, notes: string): Promise<ContractApprovalRow> {
    return this.usePgContract
      ? this.pgRepo.submitForApproval(contractId, leadId, actor, notes)
      : this.sqliteRepo.submitForApproval(contractId, leadId, actor, notes);
  }

  async listPendingApprovals(limit?: number) {
    const approvals = this.usePgContract
      ? await this.pgRepo.listPendingApprovals(limit ?? 50)
      : this.sqliteRepo.listPendingApprovals(limit ?? 50);
    return { approvals };
  }

  async listByClient(clientId: string, limit?: number) {
    const contracts = this.usePgContract
      ? await this.pgRepo.listContractsByClient(clientId, limit ?? 50)
      : this.sqliteRepo.listContractsByClient(clientId, limit ?? 50);
    return { contracts };
  }

  reject(approvalId: number, actor: string, decisionNotes: string): Promise<ContractApprovalRow> {
    return this.usePgContract
      ? this.pgRepo.rejectApproval(approvalId, actor, decisionNotes)
      : Promise.resolve(this.sqliteRepo.rejectApproval(approvalId, actor, decisionNotes));
  }

  async approve(approvalId: number, actor: string) {
    const result = this.usePgContract
      ? await this.pgRepo.approveAndPromote(approvalId, actor)
      : await this.sqliteRepo.approveAndPromote(approvalId, actor);
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
