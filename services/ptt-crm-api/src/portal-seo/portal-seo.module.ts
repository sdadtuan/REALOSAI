import { Module, forwardRef } from '@nestjs/common';
import { AgencyModule } from '../agency/agency.module';
import { ConfigModule } from '../config/config.module';
import { PortalModule } from '../portal/portal.module';
import { PortalSeoController } from './portal-seo.controller';
import { PortalSeoRepository } from './portal-seo.repository';
import { PortalSeoService } from './portal-seo.service';

@Module({
  imports: [ConfigModule, PortalModule, forwardRef(() => AgencyModule)],
  controllers: [PortalSeoController],
  providers: [PortalSeoRepository, PortalSeoService],
})
export class PortalSeoModule {}
