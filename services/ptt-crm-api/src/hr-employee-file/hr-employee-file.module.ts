import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { HrEmployeeFileEnabledGuard } from './guards/hr-employee-file-enabled.guard';
import {
  StaffHrInsuranceEditGuard,
  StaffHrInsuranceViewGuard,
} from './guards/staff-hr-insurance.guard';
import {
  StaffHrContractEditGuard,
  StaffHrContractViewGuard,
} from './guards/staff-hr-contract.guard';
import {
  StaffHrDocsDownloadGuard,
  StaffHrDocsEditGuard,
  StaffHrDocsViewGuard,
} from './guards/staff-hr-docs.guard';
import {
  StaffHrEmployeeFileViewGuard,
  StaffHrEmployeeFileWriteGuard,
} from './guards/staff-hr-employee-file.guard';
import {
  StaffHrDependentEditGuard,
  StaffHrDependentViewGuard,
} from './guards/staff-hr-dependent.guard';
import { HrDependentController } from './hr-dependent.controller';
import { HrHubController } from './hr-hub.controller';
import { HrLifecycleController } from './hr-lifecycle.controller';
import { HrInsuranceController } from './hr-insurance.controller';
import { HrInsuranceRepository } from './hr-insurance.repository';
import { HrInsuranceService } from './hr-insurance.service';
import { HrLaborContractController } from './hr-labor-contract.controller';
import { HrLaborContractRepository } from './hr-labor-contract.repository';
import { HrLaborContractService } from './hr-labor-contract.service';
import {
  StaffHrDocsApproveGuard,
  StaffHrWalletSelfGuard,
} from './guards/staff-hr-docs-approve.guard';
import { HrDocWalletMeController } from './hr-doc-wallet-me.controller';
import { HrDocWalletMeService } from './hr-doc-wallet-me.service';
import { HrDocWalletController } from './hr-doc-wallet.controller';
import { HrDocWalletRepository } from './hr-doc-wallet.repository';
import { HrDocWalletService } from './hr-doc-wallet.service';
import { HrDocWalletStorageService } from './hr-doc-wallet.storage';
import { HrEmployeeFileController } from './hr-employee-file.controller';
import { HrEmployeeFileRepository } from './hr-employee-file.repository';
import { HrEmployeeFileService } from './hr-employee-file.service';
import { HrStaffP5Repository } from './hr-staff-p5.repository';
import { HrStaffP5Service } from './hr-staff-p5.service';
import { HrAttendanceController } from './hr-attendance.controller';
import { HrAttendanceDeviceIngestController } from './hr-attendance-device-ingest.controller';
import { HrAttendanceRepository } from './hr-attendance.repository';
import { HrAttendanceService } from './hr-attendance.service';
import {
  StaffHrAttendanceDeviceGuard,
  StaffHrAttendanceGpsGuard,
  StaffHrAttendanceReviewGuard,
  StaffHrAttendanceViewGuard,
} from './guards/staff-hr-attendance.guard';

@Module({
  imports: [StaffAuthModule],
  controllers: [
    HrEmployeeFileController,
    HrDocWalletController,
    HrLaborContractController,
    HrInsuranceController,
    HrDependentController,
    HrLifecycleController,
    HrHubController,
    HrDocWalletMeController,
    HrAttendanceController,
    HrAttendanceDeviceIngestController,
  ],
  providers: [
    HrEmployeeFileRepository,
    HrDocWalletRepository,
    HrDocWalletStorageService,
    HrLaborContractRepository,
    HrInsuranceRepository,
    HrStaffP5Repository,
    HrAttendanceRepository,
    HrEmployeeFileService,
    HrDocWalletService,
    HrDocWalletMeService,
    HrLaborContractService,
    HrInsuranceService,
    HrStaffP5Service,
    HrAttendanceService,
    HrEmployeeFileEnabledGuard,
    StaffHrEmployeeFileViewGuard,
    StaffHrEmployeeFileWriteGuard,
    StaffHrContractViewGuard,
    StaffHrContractEditGuard,
    StaffHrInsuranceViewGuard,
    StaffHrInsuranceEditGuard,
    StaffHrDocsViewGuard,
    StaffHrDocsEditGuard,
    StaffHrDocsDownloadGuard,
    StaffHrDependentViewGuard,
    StaffHrDependentEditGuard,
    StaffHrDocsApproveGuard,
    StaffHrWalletSelfGuard,
    StaffHrAttendanceViewGuard,
    StaffHrAttendanceDeviceGuard,
    StaffHrAttendanceGpsGuard,
    StaffHrAttendanceReviewGuard,
  ],
  exports: [
    HrEmployeeFileRepository,
    HrEmployeeFileService,
    HrDocWalletRepository,
    HrDocWalletService,
    HrLaborContractRepository,
    HrLaborContractService,
    HrInsuranceRepository,
    HrInsuranceService,
  ],
})
export class HrEmployeeFileModule {}
