import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditExportService } from './admin-audit-export.service';
import { AdminAuditRepository } from './admin-audit.repository';
import { AdminAuditService } from './admin-audit.service';
import {
  AdminConfigSnapshotService,
  PiiAccessAuditService,
} from './admin-config-snapshot.service';

@Module({
  imports: [forwardRef(() => StaffAuthModule)],
  controllers: [AdminAuditController],
  providers: [
    AdminAuditRepository,
    AdminAuditExportService,
    AdminConfigSnapshotService,
    PiiAccessAuditService,
    AdminAuditService,
  ],
  exports: [AdminAuditRepository, PiiAccessAuditService, AdminConfigSnapshotService, AdminAuditService],
})
export class AdminAuditModule {}
