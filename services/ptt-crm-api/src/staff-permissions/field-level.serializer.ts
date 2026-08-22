import { ForbiddenException } from '@nestjs/common';
import { AgencyClientDetail, AgencyClientRow } from '../agency/agency.types';
import { LeadV1 } from '../leads/leads.types';
import { StaffSectionCap } from '../staff-auth/staff-auth.types';
import { FieldRegistryEntry, fieldRegistryEntriesForEntity } from './field-level.registry';

export type CapChecker = (caps: StaffSectionCap[], section: string, action: string) => boolean;

const DEFAULT_MASK = '••••';

export function hasFieldCap(
  caps: StaffSectionCap[],
  entry: FieldRegistryEntry,
  hasCap: CapChecker,
): boolean {
  return hasCap(caps, entry.section, entry.action);
}

export function maskPartialPii(value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.includes('@')) {
    const [local, domain] = raw.split('@');
    if (!domain) return '***';
    const head = local.length <= 2 ? '*' : `${local.slice(0, 2)}***`;
    return `${head}@${domain}`;
  }
  if (raw.length <= 4) return '***';
  return `${'*'.repeat(Math.max(3, raw.length - 4))}${raw.slice(-4)}`;
}

function applyMask(value: unknown, entry: FieldRegistryEntry): unknown {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  if (entry.mask_mode === 'partial') {
    return maskPartialPii(String(value));
  }
  if (entry.mask_mode === 'strip') {
    return '';
  }
  return entry.mask_value ?? DEFAULT_MASK;
}

export function serializeLeadForCaps(
  lead: LeadV1,
  caps: StaffSectionCap[],
  hasCap: CapChecker,
  opts?: { exportMode?: boolean },
): LeadV1 {
  const out: LeadV1 = { ...lead };
  const mutable = out as unknown as Record<string, unknown>;
  for (const entry of fieldRegistryEntriesForEntity('lead')) {
    const allowed = hasFieldCap(caps, entry, hasCap);
    if (allowed) continue;
    if (!(entry.field in out)) continue;
    if (opts?.exportMode && entry.export_strip) {
      mutable[entry.field] = '';
      continue;
    }
    mutable[entry.field] = applyMask(out[entry.field as keyof LeadV1], entry);
  }
  return out;
}

export function serializeLeadsForCaps(
  leads: LeadV1[],
  caps: StaffSectionCap[],
  hasCap: CapChecker,
  opts?: { exportMode?: boolean },
): LeadV1[] {
  return leads.map((lead) => serializeLeadForCaps(lead, caps, hasCap, opts));
}

export function assertLeadPatchFieldsAllowed(
  body: Record<string, unknown>,
  caps: StaffSectionCap[],
  hasCap: CapChecker,
): void {
  for (const entry of fieldRegistryEntriesForEntity('lead')) {
    if (!entry.patch_forbidden) continue;
    if (!(entry.field in body)) continue;
    if (hasFieldCap(caps, entry, hasCap)) continue;
    throw new ForbiddenException({
      error: 'field_abac_denied',
      entity: entry.entity,
      field: entry.field,
      required_cap: { section: entry.section, action: entry.action },
    });
  }
}

export function serializeAgencyClientRowForCaps<T extends AgencyClientRow>(
  row: T,
  caps: StaffSectionCap[],
  hasCap: CapChecker,
): T {
  const out = { ...row } as T & { billing_contact?: string | null };
  for (const entry of fieldRegistryEntriesForEntity('agency_client')) {
    if (entry.field !== 'billing_contact') continue;
    if (hasFieldCap(caps, entry, hasCap)) continue;
    if ('billing_contact' in out) {
      out.billing_contact = applyMask(out.billing_contact, entry) as string | null;
    }
  }
  return out;
}

export function serializeAgencyClientDetailForCaps(
  detail: AgencyClientDetail,
  caps: StaffSectionCap[],
  hasCap: CapChecker,
): AgencyClientDetail {
  const base = serializeAgencyClientRowForCaps(detail, caps, hasCap);
  return { ...detail, ...base };
}
