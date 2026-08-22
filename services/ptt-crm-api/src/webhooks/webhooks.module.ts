import { Module } from '@nestjs/common';
import { B2bProjectsModule } from '../b2b-projects/b2b-projects.module';
import { WebhooksEnabledGuard } from './guards/webhooks-enabled.guard';
import { JobQueueRepository } from './job-queue.repository';
import { MetaWebhookRepository } from './meta-webhook.repository';
import { MetaOpsWebhookService } from './meta-ops-webhook.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [B2bProjectsModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    JobQueueRepository,
    MetaWebhookRepository,
    MetaOpsWebhookService,
    WebhooksEnabledGuard,
  ],
  exports: [WebhooksService, JobQueueRepository, MetaWebhookRepository, MetaOpsWebhookService],
})
export class WebhooksModule {}
