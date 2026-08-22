import { Request } from 'express';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { ClientScopeContext, StaffClientScopeService } from './staff-client-scope.service';

export type StaffScopedRequest = Request & {
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'internal' | 'jwt';
};

export async function resolveStaffClientScope(
  req: StaffScopedRequest,
  clientScope: StaffClientScopeService,
): Promise<ClientScopeContext> {
  return clientScope.resolveForRequest(req);
}

export function filterRowsByClientScope<T extends { client_id?: string | null; id?: string }>(
  rows: T[],
  scope: ClientScopeContext,
  idKey: 'client_id' | 'id' = 'client_id',
): T[] {
  if (!scope.restricted) return rows;
  const allowed = new Set(scope.allowedClientIds);
  return rows.filter((row) => {
    const raw = idKey === 'id' ? row.id : row.client_id;
    const cid = String(raw ?? '').trim();
    return cid && allowed.has(cid);
  });
}
