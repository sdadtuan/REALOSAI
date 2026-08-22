import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PolicyModule } from '../policy/policy.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule, PolicyModule],
  controllers: [HealthController],
})
export class HealthModule {}
