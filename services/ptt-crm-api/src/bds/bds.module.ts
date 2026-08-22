import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffChatModule } from '../staff-chat/staff-chat.module';
import { StaffTicketModule } from '../staff-tickets/staff-ticket.module';
import { StaffOrgModule } from '../staff-org/staff-org.module';
import { BdsPackGuard } from './guards/bds-pack.guard';
import { BdsProjectOsGuard } from './guards/bds-project-os.guard';
import { BdsPolicyGuard } from './guards/bds-policy.guard';
import { BdsAgencyGuard } from './guards/bds-agency.guard';
import { BdsCollectionGuard } from './guards/bds-collection.guard';
import { BdsBuyerGuard } from './guards/bds-buyer.guard';
import { BdsCommissionGuard } from './guards/bds-commission.guard';
import { BdsUiGuard } from './guards/bds-ui.guard';
import { BdsAftersalesGuard } from './guards/bds-aftersales.guard';
import { BdsLaunchGuard } from './guards/bds-launch.guard';
import { BdsAftersalesController } from './aftersales/bds-aftersales.controller';
import { BdsAftersalesRepository } from './aftersales/bds-aftersales.repository';
import { BdsAftersalesService } from './aftersales/bds-aftersales.service';
import { BdsLaunchController } from './launches/bds-launch.controller';
import { BdsLaunchRepository } from './launches/bds-launch.repository';
import { BdsLaunchService } from './launches/bds-launch.service';
import { BdsCapiHookService } from './commission/bds-capi-hook.service';
import { BdsCommissionController } from './commission/bds-commission.controller';
import { BdsCommissionRepository } from './commission/bds-commission.repository';
import { BdsCommissionScoreService } from './commission/bds-commission-score.service';
import { BdsCommissionService } from './commission/bds-commission.service';
import { BdsBuyerIngestService } from './buyers/bds-buyer-ingest.service';
import { BdsBuyerLeadController } from './buyers/bds-buyer-lead.controller';
import { BdsBuyerLeadRepository } from './buyers/bds-buyer-lead.repository';
import { BdsBuyerLeadScopeService } from './buyers/bds-buyer-lead-scope.service';
import { BdsBuyerLeadService } from './buyers/bds-buyer-lead.service';
import { BdsBuyerMatchingService } from './buyers/bds-buyer-matching.service';
import { BdsBuyerRepository } from './buyers/bds-buyer.repository';
import { BdsBuyerVisitService } from './buyers/bds-buyer-visit.service';
import { BdsCollectionController } from './collection/bds-collection.controller';
import { BdsCollectionRepository } from './collection/bds-collection.repository';
import { BdsCollectionService } from './collection/bds-collection.service';
import { BdsAgencyController } from './agencies/bds-agency.controller';
import { BdsAgencyRepository } from './agencies/bds-agency.repository';
import { BdsAgencyService } from './agencies/bds-agency.service';
import { BdsTxGuard } from './guards/bds-tx.guard';
import { BdsHoldTtlJob } from './hold/bds-hold-ttl.job';
import { BdsHoldController } from './hold/bds-hold.controller';
import { BdsHoldRepository } from './hold/bds-hold.repository';
import { BdsHoldService } from './hold/bds-hold.service';
import { BdsInventoryController } from './inventory/bds-inventory.controller';
import { BdsInventoryService } from './inventory/bds-inventory.service';
import { BdsReProductPgRepository } from './inventory/bds-re-product-pg.repository';
import { BdsReProjectPgRepository } from './inventory/bds-re-project-pg.repository';
import { BdsOrgSeedService } from './org/bds-org-seed';
import { BdsPolicyController } from './policies/bds-policy.controller';
import { BdsPolicyRepository } from './policies/bds-policy.repository';
import { BdsPolicyService } from './policies/bds-policy.service';
import { BdsTxController } from './transactions/bds-tx.controller';
import { BdsTxRepository } from './transactions/bds-tx.repository';
import { BdsTxService } from './transactions/bds-tx.service';
import { BdsProjectOsController } from './project-os/bds-project-os.controller';
import { BdsProjectOsRepository } from './project-os/bds-project-os.repository';
import { BdsProjectOsService } from './project-os/bds-project-os.service';
import { BdsTenantController } from './tenant/bds-tenant.controller';
import { BdsTenantRepository } from './tenant/bds-tenant.repository';
import { BdsTenantService } from './tenant/bds-tenant.service';
import { BdsHubController } from './reports/bds-hub.controller';
import { BdsHubRepository } from './reports/bds-hub.repository';
import { BdsHubService } from './reports/bds-hub.service';

@Module({
  imports: [StaffAuthModule, StaffOrgModule, StaffChatModule, StaffTicketModule],
  controllers: [
    BdsTenantController,
    BdsInventoryController,
    BdsProjectOsController,
    BdsHoldController,
    BdsPolicyController,
    BdsTxController,
    BdsAgencyController,
    BdsCollectionController,
    BdsBuyerLeadController,
    BdsCommissionController,
    BdsHubController,
    BdsAftersalesController,
    BdsLaunchController,
  ],
  providers: [
    BdsPackGuard,
    BdsProjectOsGuard,
    BdsPolicyGuard,
    BdsTxGuard,
    BdsAgencyGuard,
    BdsCollectionGuard,
    BdsBuyerGuard,
    BdsCommissionGuard,
    BdsUiGuard,
    BdsAftersalesGuard,
    BdsLaunchGuard,
    BdsCommissionRepository,
    BdsCommissionService,
    BdsCommissionScoreService,
    BdsCapiHookService,
    BdsBuyerIngestService,
    BdsBuyerRepository,
    BdsBuyerLeadRepository,
    BdsBuyerLeadScopeService,
    BdsBuyerLeadService,
    BdsBuyerMatchingService,
    BdsBuyerVisitService,
    BdsTenantRepository,
    BdsTenantService,
    BdsOrgSeedService,
    BdsReProjectPgRepository,
    BdsReProductPgRepository,
    BdsInventoryService,
    BdsProjectOsRepository,
    BdsProjectOsService,
    BdsHoldRepository,
    BdsHoldService,
    BdsHoldTtlJob,
    BdsPolicyRepository,
    BdsPolicyService,
    BdsTxRepository,
    BdsTxService,
    BdsAgencyRepository,
    BdsAgencyService,
    BdsCollectionRepository,
    BdsCollectionService,
    BdsHubRepository,
    BdsHubService,
    BdsAftersalesRepository,
    BdsAftersalesService,
    BdsLaunchRepository,
    BdsLaunchService,
  ],
  exports: [
    BdsTenantService,
    BdsReProjectPgRepository,
    BdsReProductPgRepository,
    BdsInventoryService,
    BdsProjectOsService,
    BdsHoldService,
    BdsPolicyService,
    BdsTxService,
    BdsAgencyService,
    BdsCollectionService,
    BdsBuyerIngestService,
    BdsBuyerLeadService,
    BdsBuyerLeadRepository,
    BdsCommissionService,
    BdsHubService,
    BdsAftersalesService,
    BdsLaunchService,
  ],
})
export class BdsModule {}
