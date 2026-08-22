import { Module } from '@nestjs/common';
import { StaffAuthModule } from '../staff-auth/staff-auth.module';
import { StaffChatController } from './staff-chat.controller';
import { StaffChatGuard } from './staff-chat.guard';
import { StaffChatRepository } from './staff-chat.repository';
import { StaffChatService } from './staff-chat.service';

@Module({
  imports: [StaffAuthModule],
  controllers: [StaffChatController],
  providers: [StaffChatRepository, StaffChatService, StaffChatGuard],
  exports: [StaffChatService],
})
export class StaffChatModule {}
