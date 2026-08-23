import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CasesController } from './cases.controller';
import { CasesPgRepository } from './cases-pg.repository';
import { CasesService } from './cases.service';
import { CasesSqliteRepository } from './cases-sqlite.repository';
import { StaffCasesViewGuard, StaffCasesWriteGuard } from './guards/staff-cases.guard';

@Module({
  imports: [StaffAuthModule],
  controllers: [CasesController],
  providers: [
    CasesService,
    CasesSqliteRepository,
    CasesPgRepository,
    StaffCasesViewGuard,
    StaffCasesWriteGuard,
  ],
  exports: [CasesService, CasesSqliteRepository, CasesPgRepository, StaffCasesViewGuard, StaffCasesWriteGuard],
})
export class CasesModule {}
