import { Module, forwardRef } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { ContentAuditService } from './content-audit.service';
import { ContentBrandContextService } from './content-brand-context.service';
import { ContentCalendarService } from './content-calendar.service';
import { ContentCommentsService } from './content-comments.service';
import { ContentEmailBridgeService } from './content-email-bridge.service';
import { ContentExternalMetricsService } from './content-external-metrics.service';
import { ContentMediaAssetCacheService } from './content-media-asset-cache.service';
import { ContentMediaCleanService } from './content-media-clean.service';
import { ContentMediaStockProvider } from './content-media-stock.provider';
import { ContentMediaTtsProvider } from './content-media-tts.provider';
import { ContentMediaVideoProvider } from './content-media-video.provider';
import { ContentGenerateService } from './content-generate.service';
import { ContentIdeaService } from './content-idea.service';
import { ContentIntelligenceService } from './content-intelligence.service';
import { ContentMetricsService } from './content-metrics.service';
import { ContentItemService } from './content-item.service';
import { ContentJobWorkerService } from './content-job-worker.service';
import { ContentPlanSnapshotService } from './content-plan-snapshot.service';
import { ContentProductionService } from './content-production.service';
import { ContentMediaGenerateService } from './content-media-generate.service';
import { ContentMediaImageProvider } from './content-media-image.provider';
import { ContentMediaStorageService } from './content-media-storage.service';
import { ReplicateMediaProvider } from './content-media-replicate.provider';
import { StubMediaProvider } from './content-media-stub.provider';
import { ContentVisualQaService } from './content-visual-qa.service';
import { ContentPillarService } from './content-pillar.service';
import { ContentRepurposeService } from './content-repurpose.service';
import { ContentSeoBridgeService } from './content-seo-bridge.service';
import { ContentSeoBridgeSyncService } from './content-seo-bridge-sync.service';
import { ContentVisualService } from './content-visual.service';
import { ContentWorkflowService } from './content-workflow.service';
import { ContentMarketingController } from './content-marketing.controller';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import { EmailMarketingModule } from '../email-marketing/email-marketing.module';
import { SeoContentModule } from '../seo-content/seo-content.module';
import {
  StaffContentMarketingApproveGuard,
  StaffContentMarketingAssignGuard,
  StaffContentMarketingGenerateGuard,
  StaffContentMarketingProductionGuard,
  StaffContentMarketingPublishGuard,
  StaffContentMarketingViewGuard,
  StaffContentMarketingWriteGuard,
} from './guards/staff-content-marketing.guard';
import { AppConfigService } from '../config/app-config.service';
import { Pool } from 'pg';
import { VideoLicenseRepository } from './video-kernel/video-license.repository';
import { SocialFfmpegComposer } from './video-social/social-ffmpeg.composer';
import { SocialVideoService } from './video-social/social-video.service';

@Module({
  imports: [
    StaffAuthModule,
    AiIntelligenceModule,
    SeoContentModule,
    EmailMarketingModule,
    forwardRef(() => ServiceLifecycleModule),
  ],
  controllers: [ContentMarketingController],
  providers: [
    ContentMarketingRepository,
    ContentMarketingService,
    ContentBrandContextService,
    ContentPlanSnapshotService,
    ContentWorkflowService,
    ContentCalendarService,
    ContentAuditService,
    ContentCommentsService,
    ContentMetricsService,
    ContentIntelligenceService,
    ContentExternalMetricsService,
    ContentPillarService,
    ContentRepurposeService,
    ContentSeoBridgeService,
    ContentSeoBridgeSyncService,
    ContentEmailBridgeService,
    ContentProductionService,
    StubMediaProvider,
    ReplicateMediaProvider,
    ContentMediaAssetCacheService,
    ContentMediaCleanService,
    ContentMediaTtsProvider,
    ContentMediaStockProvider,
    ContentMediaVideoProvider,
    ContentMediaStorageService,
    ContentVisualQaService,
    ContentMediaImageProvider,
    ContentMediaGenerateService,
    SocialFfmpegComposer,
    SocialVideoService,
    {
      provide: VideoLicenseRepository,
      useFactory: (config: AppConfigService) =>
        new VideoLicenseRepository(new Pool({ connectionString: config.databaseUrl })),
      inject: [AppConfigService],
    },
    ContentVisualService,
    ContentGenerateService,
    ContentJobWorkerService,
    ContentIdeaService,
    ContentItemService,
    StaffContentMarketingViewGuard,
    StaffContentMarketingWriteGuard,
    StaffContentMarketingGenerateGuard,
    StaffContentMarketingApproveGuard,
    StaffContentMarketingAssignGuard,
    StaffContentMarketingPublishGuard,
    StaffContentMarketingProductionGuard,
  ],
  exports: [
    ContentMarketingService,
    ContentMarketingRepository,
    ContentPlanSnapshotService,
    ContentGenerateService,
    ContentIdeaService,
    ContentItemService,
    ContentWorkflowService,
  ],
})
export class ContentMarketingModule {}
