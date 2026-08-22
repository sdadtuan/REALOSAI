import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffOrgModule } from '../staff-org/staff-org.module';
import { BdsPackGuard } from './guards/bds-pack.guard';
import { BdsProjectOsGuard } from './guards/bds-project-os.guard';
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
  controllers: [BdsTenantController, BdsInventoryController, BdsProjectOsController],
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
  ],
  exports: [
    BdsTenantService,
    BdsReProjectPgRepository,
    BdsReProductPgRepository,
    BdsInventoryService,
    BdsProjectOsService,
  ],
})
export class BdsModule {}
