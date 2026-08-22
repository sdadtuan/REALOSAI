import type { StoredStaffUser } from '@/lib/auth';

export function isSandboxVisitor(user: StoredStaffUser | null): boolean {
  return user?.position_code === 'sandbox_visitor';
}

export function canViewSandboxLeads(user: StoredStaffUser | null): boolean {
  if (!isSandboxVisitor(user)) return false;
  return user?.caps?.some((c) => c.section === 'sandbox.leads' && c.action === 'view') ?? true;
}

export function canViewSandboxBoard(user: StoredStaffUser | null): boolean {
  if (!isSandboxVisitor(user)) return false;
  return user?.caps?.some((c) => c.section === 'sandbox.board' && c.action === 'view') ?? true;
}

export const SANDBOX_ALLOWED_PREFIXES = ['/sandbox', '/login', '/403'];

export function isSandboxAllowedPath(pathname: string): boolean {
  return SANDBOX_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
