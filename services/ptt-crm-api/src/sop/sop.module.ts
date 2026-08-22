import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffSopViewGuard, StaffSopWriteGuard } from './guards/staff-sop.guard';
import { SopAutoStartService } from './sop-auto-start.service';
import { SopController } from './sop.controller';
import { SopPgRepository } from './sop-pg.repository';
import { SopSqliteRepository } from './sop-sqlite.repository';
import { SopService } from './sop.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [SopController],
  providers: [
    SopService,
    SopSqliteRepository,
    SopPgRepository,
    SopAutoStartService,
    StaffSopViewGuard,
    StaffSopWriteGuard,
  ],
  exports: [SopService, SopAutoStartService, SopSqliteRepository, SopPgRepository],
})
export class SopModule {}
