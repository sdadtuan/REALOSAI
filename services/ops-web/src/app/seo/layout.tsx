import { StaffRouteGuard } from '@/components/auth/StaffRouteGuard';

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return <StaffRouteGuard zone="seo">{children}</StaffRouteGuard>;
}
