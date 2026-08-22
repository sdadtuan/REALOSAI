import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffOrgModule } from '../staff-org/staff-org.module';
import { BdsPackGuard } from './guards/bds-pack.guard';
import { BdsInventoryController } from './inventory/bds-inventory.controller';
import { BdsInventoryService } from './inventory/bds-inventory.service';
import { BdsReProductPgRepository } from './inventory/bds-re-product-pg.repository';
import { BdsReProjectPgRepository } from './inventory/bds-re-project-pg.repository';
import { BdsOrgSeedService } from './org/bds-org-seed';
import { BdsTenantController } from './tenant/bds-tenant.controller';
import { BdsTenantRepository } from './tenant/bds-tenant.repository';
import { BdsTenantService } from './tenant/bds-tenant.service';

@Module({
  imports: [StaffAuthModule, StaffOrgModule],
  controllers: [BdsTenantController, BdsInventoryController],
  providers: [
    BdsPackGuard,
    BdsTenantRepository,
    BdsTenantService,
    BdsOrgSeedService,
    BdsReProjectPgRepository,
    BdsReProductPgRepository,
    BdsInventoryService,
  ],
  exports: [
    BdsTenantService,
    BdsReProjectPgRepository,
    BdsReProductPgRepository,
    BdsInventoryService,
  ],
})
export class BdsModule {}
