import { StaffRouteGuard } from '@/components/auth/StaffRouteGuard';

export default function EmailLayout({ children }: { children: React.ReactNode }) {
  return <StaffRouteGuard zone="email">{children}</StaffRouteGuard>;
}
