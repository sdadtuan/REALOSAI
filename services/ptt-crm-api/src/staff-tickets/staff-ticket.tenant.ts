export const STAFF_TICKET_TENANT_LOOKUP = Symbol('STAFF_TICKET_TENANT_LOOKUP');

export type StaffTicketTenantLookup = {
  getMe(tenantId: string): Promise<{ mode: string; id?: string }>;
};
