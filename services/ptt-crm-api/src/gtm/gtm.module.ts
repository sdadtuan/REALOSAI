import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '../config/config.module';
import { PgLeadsWriteRepository } from '../leads/pg-leads-write.repository';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffGtmDemosViewGuard, StaffGtmDemosWriteGuard } from './guards/staff-gtm-demos.guard';
import { StaffGtmSandboxGrantGuard, StaffGtmDemosExportGuard } from './guards/staff-gtm-sandbox.guard';
import { GtmPaymentRepository } from './gtm-payment.repository';
import { GtmPublicController } from './gtm-public.controller';
import { GtmSandboxAuthController } from './gtm-sandbox-auth.controller';
import { GtmSandboxAuthService } from './gtm-sandbox-auth.service';
import { GtmSandboxBoardService } from './gtm-sandbox-board.service';
import { GtmStripeService } from './gtm-stripe.service';
import { GtmStripeWebhookController } from './gtm-stripe-webhook.controller';
import { GtmPublicStatusService } from './gtm-public-status.service';
import { GtmRepository } from './gtm.repository';
import { GtmService } from './gtm.service';
import { GtmStaffController } from './gtm-staff.controller';
import { GtmSandboxService } from './gtm-sandbox.service';
import { GtmSandboxExpiryJob } from './gtm-sandbox-expiry.job';
import { GtmExportService } from './gtm-export.service';
import { GtmImportService } from './gtm-import.service';
import { GtmProposalService } from './gtm-proposal.service';
import {
  ConsoleGtmSandboxMailer,
  GTM_SANDBOX_MAILER,
} from './gtm-sandbox.mailer';
import {
  GTM_SANDBOX_STORE,
  InMemoryGtmSandboxStore,
} from './gtm-sandbox.store';

@Module({
  imports: [ConfigModule, StaffAuthModule, ScheduleModule.forRoot()],
  controllers: [
    GtmPublicController,
    GtmStaffController,
    GtmStripeWebhookController,
    GtmSandboxAuthController,
  ],
  providers: [
    GtmRepository,
    GtmPaymentRepository,
    GtmService,
    GtmStripeService,
    GtmSandboxAuthService,
    GtmSandboxBoardService,
    GtmSandboxService,
    GtmSandboxExpiryJob,
    GtmExportService,
    GtmImportService,
    GtmProposalService,
    GtmPublicStatusService,
    PgLeadsWriteRepository,
    StaffGtmDemosViewGuard,
    StaffGtmDemosWriteGuard,
    StaffGtmSandboxGrantGuard,
    StaffGtmDemosExportGuard,
    { provide: GTM_SANDBOX_MAILER, useClass: ConsoleGtmSandboxMailer },
    { provide: GTM_SANDBOX_STORE, useClass: InMemoryGtmSandboxStore },
  ],
  exports: [GtmService, GtmRepository, GtmSandboxService],
})
export class GtmModule {}
