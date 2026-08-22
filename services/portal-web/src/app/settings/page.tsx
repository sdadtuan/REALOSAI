'use client';

import { BrandingSettingsForm } from '@/components/settings/BrandingSettingsForm';
import { ChangePasswordForm } from '@/components/settings/ChangePasswordForm';
import {
  CapacitorNativePushCard,
  PushNotificationCard,
} from '@/components/settings/PushSettingsCards';
import { SettingsPortalShell } from '@/components/settings/SettingsPortalShell';

export default function SettingsPage() {
  return (
    <SettingsPortalShell>
      {({ token, user, refreshBranding }) => (
        <>
          <CapacitorNativePushCard token={token} />
          <PushNotificationCard token={token} />
          <BrandingSettingsForm
            token={token}
            canEdit={user.role === 'approver'}
            onUpdated={() => void refreshBranding()}
          />
          <ChangePasswordForm token={token} email={user.email} />
        </>
      )}
    </SettingsPortalShell>
  );
}
