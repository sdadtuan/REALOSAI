import { Module } from '@nestjs/common';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';

@Module({
  providers: [MarketingAiPlannerRepository, MarketingAiPlaybookService],
  exports: [MarketingAiPlaybookService],
})
export class MarketingAiPlaybookModule {}
