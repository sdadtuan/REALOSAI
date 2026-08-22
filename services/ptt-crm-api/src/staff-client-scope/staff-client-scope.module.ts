import { Module, forwardRef } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffClientScopeService } from './staff-client-scope.service';
import { StaffUserClientsRepository } from './staff-user-clients.repository';

@Module({
  imports: [forwardRef(() => StaffAuthModule)],
  providers: [StaffUserClientsRepository, StaffClientScopeService],
  exports: [StaffUserClientsRepository, StaffClientScopeService],
})
export class StaffClientScopeModule {}
