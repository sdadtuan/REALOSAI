import { StaffRouteGuard } from '@/components/auth/StaffRouteGuard';

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <StaffRouteGuard zone="crm">{children}</StaffRouteGuard>;
}
