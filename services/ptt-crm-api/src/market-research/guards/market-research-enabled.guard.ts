import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class MarketResearchEnabledGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.config.marketResearchEnabled) {
      throw new NotFoundException({ error: 'market_research_disabled' });
    }
    return true;
  }
}
