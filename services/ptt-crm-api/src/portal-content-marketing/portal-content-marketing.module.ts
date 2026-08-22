import { Module, forwardRef } from '@nestjs/common';
import { ContentMarketingModule } from '../content-marketing/content-marketing.module';
import { PortalModule } from '../portal/portal.module';
import { ServiceLifecycleModule } from '../service-lifecycle/service-lifecycle.module';
import { PortalContentMarketingController } from './portal-content-marketing.controller';
import { PortalContentMarketingSummaryService } from './portal-content-marketing-summary.service';

@Module({
  imports: [PortalModule, ServiceLifecycleModule, forwardRef(() => ContentMarketingModule)],
  controllers: [PortalContentMarketingController],
  providers: [PortalContentMarketingSummaryService],
})
export class PortalContentMarketingModule {}
