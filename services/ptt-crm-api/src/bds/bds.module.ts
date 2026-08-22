import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffOrgModule } from '../staff-org/staff-org.module';
import { BdsPackGuard } from './guards/bds-pack.guard';
import { BdsProjectOsGuard } from './guards/bds-project-os.guard';
import { BdsPolicyGuard } from './guards/bds-policy.guard';
import { BdsAgencyGuard } from './guards/bds-agency.guard';
import { BdsCollectionGuard } from './guards/bds-collection.guard';
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

@Module({
  imports: [StaffAuthModule, StaffOrgModule],
  controllers: [
    BdsTenantController,
    BdsInventoryController,
    BdsProjectOsController,
    BdsHoldController,
    BdsPolicyController,
    BdsTxController,
    BdsAgencyController,
    BdsCollectionController,
  ],
  providers: [
    BdsPackGuard,
    BdsProjectOsGuard,
    BdsPolicyGuard,
    BdsTxGuard,
    BdsAgencyGuard,
    BdsCollectionGuard,
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
  ],
})
export class BdsModule {}
