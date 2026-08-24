import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { CasesController } from './cases.controller';
import { CasesPgRepository } from './cases-pg.repository';
import { CasesService } from './cases.service';
import { StaffCasesViewGuard, StaffCasesWriteGuard } from './guards/staff-cases.guard';

@Module({
  imports: [StaffAuthModule],
  controllers: [CasesController],
  providers: [
    CasesService,
    CasesPgRepository,
    StaffCasesViewGuard,
    StaffCasesWriteGuard,
  ],
  exports: [CasesService, CasesPgRepository, StaffCasesViewGuard, StaffCasesWriteGuard],
})
export class CasesModule {}
