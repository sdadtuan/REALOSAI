import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { MarketResearchEnabledGuard } from '../market-research/guards/market-research-enabled.guard';
import { PortalModule } from '../portal/portal.module';
import { PortalResearchController } from './portal-research.controller';
import { PortalResearchRepository } from './portal-research.repository';
import { PortalResearchService } from './portal-research.service';

@Module({
  imports: [ConfigModule, PortalModule],
  controllers: [PortalResearchController],
  providers: [PortalResearchRepository, PortalResearchService, MarketResearchEnabledGuard],
})
export class PortalResearchModule {}
