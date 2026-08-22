import { Module } from '@nestjs/common';
import { ContentMarketingModule } from '../content-marketing/content-marketing.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import {
  StaffVdBibleEditGuard,
  StaffVdBudgetEditGuard,
  StaffVdGateApproveGuard,
  StaffVdKeyframeEditGuard,
  StaffVdMotionEditGuard,
  StaffVdPostEditGuard,
  StaffVdQcEditGuard,
  StaffVdProjectCreateGuard,
  StaffVdProjectEditGuard,
  StaffVdProjectViewGuard,
  StaffVdScriptEditGuard,
  StaffVdShotJobEnqueueGuard,
} from './guards/staff-vd-project.guard';
import { VdAssetRepository } from './assets/vd-asset.repository';
import { VdBibleController } from './bible/vd-bible.controller';
import { VdBibleRepository } from './bible/vd-bible.repository';
import { VdBibleService } from './bible/vd-bible.service';
import { VdJobController } from './jobs/vd-job.controller';
import { VdJobHttpService } from './jobs/vd-job-http.service';
import { VdJobRepository } from './jobs/vd-job.repository';
import { VdDispatcherService } from './orchestration/vd-dispatcher.service';
import { VdPollerService } from './orchestration/vd-poller.service';
import { VdWebhookController } from './orchestration/vd-webhook.controller';
import { VdWebhookEventRepository } from './orchestration/vd-webhook-event.repository';
import { VdWebhookService } from './orchestration/vd-webhook.service';
import { VdCostController } from './cost/vd-cost.controller';
import { VdCostRepository } from './cost/vd-cost.repository';
import { VdCostService } from './cost/vd-cost.service';
import { VdGateController } from './gate/vd-gate.controller';
import { VdGateRepository } from './gate/vd-gate.repository';
import { VdGateService } from './gate/vd-gate.service';
import { VdMotionController } from './render/vd-motion.controller';
import { VdMotionService } from './render/vd-motion.service';
import { VdTakeRepository } from './render/vd-take.repository';
import { VdPostController } from './post/vd-post.controller';
import { VdPostService } from './post/vd-post.service';
import { VdDeliveryController } from './post/vd-delivery.controller';
import { VdDeliveryService } from './post/vd-delivery.service';
import { VdDeliveryRepository } from './post/vd-delivery.repository';
import { VdReviewController } from './review/vd-review.controller';
import { VdReviewService } from './review/vd-review.service';
import { VdReviewRepository } from './review/vd-review.repository';
import { VdPublicReviewController } from './review/vd-public-review.controller';
import { VdReportController } from './report/vd-report.controller';
import { VdReportService } from './report/vd-report.service';
import { VdBenchmarkRepository } from './report/vd-benchmark.repository';
import { VdPromptController } from './prompt/vd-prompt.controller';
import { VdPromptRepository } from './prompt/vd-prompt.repository';
import { VdPromptService } from './prompt/vd-prompt.service';
import { VdBriefController } from './project/vd-brief.controller';
import { VdBriefService } from './project/vd-brief.service';
import { VdProjectController } from './project/vd-project.controller';
import { VdProjectHttpService } from './project/vd-project-http.service';
import { VdProjectRepository } from './project/vd-project.repository';
import { VdProjectService } from './project/vd-project.service';
import { StaffVdAdminCreateGuard, StaffVdAdminViewGuard } from './admin/staff-vd-admin.guard';
import { VdAdminController } from './admin/vd-admin.controller';
import { VdAdminService } from './admin/vd-admin.service';
import { VdIdeaRepository } from './script/vd-idea.repository';
import { VdScriptController } from './script/vd-script.controller';
import { VdScriptService } from './script/vd-script.service';
import { VdShotRepository } from './script/vd-shot.repository';

@Module({
  imports: [StaffAuthModule, ContentMarketingModule],
  controllers: [
    VdProjectController,
    VdBriefController,
    VdScriptController,
    VdJobController,
    VdAdminController,
    VdBibleController,
    VdPromptController,
    VdGateController,
    VdMotionController,
    VdCostController,
    VdPostController,
    VdDeliveryController,
    VdReviewController,
    VdPublicReviewController,
    VdReportController,
    VdWebhookController,
  ],
  providers: [
    VdProjectRepository,
    VdProjectService,
    VdProjectHttpService,
    VdBriefService,
    VdIdeaRepository,
    VdShotRepository,
    VdScriptService,
    VdJobRepository,
    VdAssetRepository,
    VdBibleRepository,
    VdBibleService,
    VdPromptRepository,
    VdPromptService,
    VdGateRepository,
    VdGateService,
    VdTakeRepository,
    VdMotionService,
    VdCostRepository,
    VdCostService,
    VdPostService,
    VdDeliveryRepository,
    VdDeliveryService,
    VdReviewRepository,
    VdReviewService,
    VdReportService,
    VdBenchmarkRepository,
    VdDispatcherService,
    VdPollerService,
    VdWebhookEventRepository,
    VdWebhookService,
    VdJobHttpService,
    VdAdminService,
    StaffVdProjectCreateGuard,
    StaffVdProjectEditGuard,
    StaffVdProjectViewGuard,
    StaffVdScriptEditGuard,
    StaffVdBibleEditGuard,
    StaffVdGateApproveGuard,
    StaffVdKeyframeEditGuard,
    StaffVdMotionEditGuard,
    StaffVdShotJobEnqueueGuard,
    StaffVdBudgetEditGuard,
    StaffVdPostEditGuard,
    StaffVdQcEditGuard,
    StaffVdAdminViewGuard,
    StaffVdAdminCreateGuard,
  ],
})
export class VideoSopModule {}
