import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AssignScopesController, CatalogController } from './catalog.controller';
import { CatalogPgRepository } from './catalog-pg.repository';
import { CatalogService } from './catalog.service';
import { StaffCatalogConfigureGuard, StaffCatalogViewGuard } from './guards/staff-catalog.guard';

@Module({
  imports: [StaffAuthModule],
  controllers: [CatalogController, AssignScopesController],
  providers: [
    CatalogService,
    CatalogPgRepository,
    StaffCatalogViewGuard,
    StaffCatalogConfigureGuard,
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
