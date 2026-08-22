import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiScoreAsyncService } from './ai-score-async.service';

/** RNOS-08 — isolated module to avoid LeadsModule ↔ AiIntelligenceModule circular imports. */
@Module({
  imports: [WebhooksModule],
  providers: [AiIntelligenceConfigService, AiScoreAsyncService],
  exports: [AiScoreAsyncService],
})
export class AiScoreAsyncModule {}
