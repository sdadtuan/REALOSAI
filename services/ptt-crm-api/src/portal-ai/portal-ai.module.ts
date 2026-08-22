import { Module } from '@nestjs/common';
import { AiIntelligenceModule } from '../ai-intelligence/ai-intelligence.module';
import { PerformanceModule } from '../performance/performance.module';
import { PortalModule } from '../portal/portal.module';
import { PortalAiReportController } from './portal-ai-report.controller';
import { PortalAiReportService } from './portal-ai-report.service';

@Module({
  imports: [PortalModule, PerformanceModule, AiIntelligenceModule],
  controllers: [PortalAiReportController],
  providers: [PortalAiReportService],
  exports: [PortalAiReportService],
})
export class PortalAiModule {}
