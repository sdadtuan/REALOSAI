import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffOrgModule } from '../staff-org/staff-org.module';
import { BdsPackGuard } from './guards/bds-pack.guard';
import { BdsProjectOsGuard } from './guards/bds-project-os.guard';
import { BdsHoldTtlJob } from './hold/bds-hold-ttl.job';
import { BdsHoldController } from './hold/bds-hold.controller';
import { BdsHoldRepository } from './hold/bds-hold.repository';
import { BdsHoldService } from './hold/bds-hold.service';
import { BdsInventoryController } from './inventory/bds-inventory.controller';
import { BdsInventoryService } from './inventory/bds-inventory.service';
import { BdsReProductPgRepository } from './inventory/bds-re-product-pg.repository';
import { BdsReProjectPgRepository } from './inventory/bds-re-project-pg.repository';
import { BdsOrgSeedService } from './org/bds-org-seed';
import { BdsProjectOsController } from './project-os/bds-project-os.controller';
import { BdsProjectOsRepository } from './project-os/bds-project-os.repository';
import { BdsProjectOsService } from './project-os/bds-project-os.service';
import { BdsTenantController } from './tenant/bds-tenant.controller';
import { BdsTenantRepository } from './tenant/bds-tenant.repository';
import { BdsTenantService } from './tenant/bds-tenant.service';

@Module({
  imports: [StaffAuthModule, StaffOrgModule],
  controllers: [BdsTenantController, BdsInventoryController, BdsProjectOsController, BdsHoldController],
  providers: [
    BdsPackGuard,
    BdsProjectOsGuard,
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
  ],
  exports: [
    BdsTenantService,
    BdsReProjectPgRepository,
    BdsReProductPgRepository,
    BdsInventoryService,
    BdsProjectOsService,
    BdsHoldService,
  ],
})
export class BdsModule {}
