import { Controller, Get, UseGuards } from '@nestjs/common';
import { StaffAiAdminGuard } from '../ai-intelligence/guards/staff-ai-admin.guard';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';

@Controller()
export class MarketingAiPlaybookAdminController {
  constructor(private readonly playbooks: MarketingAiPlaybookService) {}

  /** WS-P4-08-T3 — read-only playbook catalog for DevOps/admin */
  @Get('api/v1/admin/mkt-ai/playbooks')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
  listPlaybooks() {
    return this.playbooks.listAdminCatalog();
  }
}
