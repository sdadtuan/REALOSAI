import { Module, forwardRef } from '@nestjs/common';
import { AgencyModule } from '../agency/agency.module';
import { PortalAuthController } from './portal-auth.controller';
import { PortalAuthService } from './portal-auth.service';
import { CampaignMilestoneNotifyService } from '../agency/campaign-milestone-notify.service';
import { PortalCreativeNotifyService } from './portal-creative-notify.service';
import { PortalNotificationController } from './portal-notification.controller';
import { PortalNotificationRepository } from './portal-notification.repository';
import { PortalNotificationService } from './portal-notification.service';
import { PortalNotifyWebhookService } from './portal-notify-webhook.service';
import { PortalPasswordResetNotifyService } from './portal-password-reset-notify.service';
import { PortalCredentialsNotifyService } from './portal-credentials-notify.service';
import { PortalPasswordResetRepository } from './portal-password-reset.repository';
import { PortalPasswordResetService } from './portal-password-reset.service';
import { PortalMobileController } from './portal-mobile.controller';
import { PortalMobileService } from './portal-mobile.service';
import { PortalNativeDeviceRepository } from './portal-native-device.repository';
import { PortalNativePushSenderService } from './portal-native-push-sender.service';
import { PortalPushController } from './portal-push.controller';
import { PortalPushRepository } from './portal-push.repository';
import { PortalPushSenderService } from './portal-push-sender.service';
import { PortalPushService } from './portal-push.service';
import { PortalJwtGuard } from './portal-jwt.guard';
import { PortalSettingsController } from './portal-settings.controller';
import { PortalSettingsRepository } from './portal-settings.repository';
import { PortalSettingsService } from './portal-settings.service';

@Module({
  imports: [forwardRef(() => AgencyModule)],
  controllers: [
    PortalAuthController,
    PortalSettingsController,
    PortalNotificationController,
    PortalPushController,
    PortalMobileController,
  ],
  providers: [
    PortalAuthService,
    PortalJwtGuard,
    PortalSettingsRepository,
    PortalSettingsService,
    PortalNotifyWebhookService,
    PortalNotificationRepository,
    PortalNotificationService,
    PortalCreativeNotifyService,
    CampaignMilestoneNotifyService,
    PortalPasswordResetRepository,
    PortalPasswordResetNotifyService,
    PortalCredentialsNotifyService,
    PortalPasswordResetService,
    PortalPushRepository,
    PortalPushService,
    PortalPushSenderService,
    PortalNativeDeviceRepository,
    PortalNativePushSenderService,
    PortalMobileService,
  ],
  exports: [
    PortalAuthService,
    PortalJwtGuard,
    PortalSettingsService,
    PortalCreativeNotifyService,
    PortalNotificationService,
    PortalNotifyWebhookService,
    PortalCredentialsNotifyService,
    CampaignMilestoneNotifyService,
    PortalPasswordResetService,
    PortalPushSenderService,
    PortalNativePushSenderService,
    PortalMobileService,
    forwardRef(() => AgencyModule),
  ],
})
export class PortalModule {}
