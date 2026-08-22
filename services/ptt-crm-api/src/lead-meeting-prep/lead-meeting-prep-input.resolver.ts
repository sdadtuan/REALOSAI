import { Injectable } from '@nestjs/common';
import { resolveLeadFlowKind } from '../leads-funnel/lead-flow-kind.util';
import type { LeadMeetingPrepInput, LeadPrepContextRow } from './lead-meeting-prep.types';

function pickString(meta: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = meta[key];
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim();
    }
  }
  return '';
}

export interface ResolvedPrepInput {
  input: LeadMeetingPrepInput;
  sources_map: Record<string, string>;
  skip_reason?: string;
}

@Injectable()
export class LeadMeetingPrepInputResolver {
  resolve(row: LeadPrepContextRow): ResolvedPrepInput {
    const meta = row.meta_json ?? {};
    const sources: Record<string, string> = {};

    const fullName = String(row.full_name ?? '').trim();
    const phone = String(row.phone ?? '').trim();
    const email = String(row.email ?? '').trim();

    let companyName = pickString(meta, 'company_name', 'company');
    if (companyName) sources.company_name = 'meta_json';

    const industry = pickString(meta, 'industry', 'industry_slug');
    if (industry) sources.industry = 'meta_json';

    const marketingBudget = pickString(meta, 'budget', 'marketing_budget');
    const formData =
      typeof meta.form_data === 'object' && meta.form_data !== null
        ? (meta.form_data as Record<string, unknown>)
        : {};
    const budgetFromForm = pickString(formData, 'budget');
    const budget = marketingBudget || budgetFromForm;

    const problem =
      pickString(meta, 'notes', 'need', 'problem') || pickString(formData, 'need');

    let websiteUrl = pickString(meta, 'website_url', 'domain', 'website');
    if (websiteUrl) sources.website_url = 'meta_json';

    const socialUrls = pickString(meta, 'social_urls', 'facebook_page_url', 'page_url');

    const input: LeadMeetingPrepInput = {
      lead_id: row.lead_id,
      full_name: fullName,
      phone,
      email,
      company_name: companyName,
      industry,
      marketing_budget: budget,
      problem,
      website_url: websiteUrl || undefined,
      social_urls: socialUrls || undefined,
      client_id: row.client_id,
      channel: row.channel,
      source: row.source,
    };

    if (!companyName || companyName.length < 2) {
      return { input, sources_map: sources, skip_reason: 'missing_company_name' };
    }
    if (!phone && !email) {
      return { input, sources_map: sources, skip_reason: 'missing_contact' };
    }

    return { input, sources_map: sources };
  }

  isEligibleForAutoEnqueue(
    row: LeadPrepContextRow,
    opts: { pilotClientIds: string[]; pilotOnly?: boolean },
  ): string | null {
    return this.isEligibleForEnqueue(row, opts, { requireInputFields: true });
  }

  /** M2/M3/M4 — lighter gate; GA skips pilot list when pilotOnly=false. */
  isEligibleForEnqueue(
    row: LeadPrepContextRow,
    opts: { pilotClientIds: string[]; pilotOnly?: boolean },
    gate: { requireInputFields?: boolean } = {},
  ): string | null {
    if (row.is_duplicate) return 'duplicate_lead';

    const flowKind = resolveLeadFlowKind({
      clientId: row.client_id,
      channel: row.channel,
      source: row.source,
      status: row.status,
      metaJson: row.meta_json,
      hasPresales: false,
    });
    if (flowKind === 'spa_operational') return 'spa_operational';

    const pilotOnly = opts.pilotOnly !== false;
    const clientId = String(row.client_id ?? '').trim().toLowerCase();
    if (pilotOnly && opts.pilotClientIds.length > 0) {
      if (!clientId || !opts.pilotClientIds.includes(clientId)) {
        return 'pilot_client_mismatch';
      }
    }

    if (gate.requireInputFields) {
      const resolved = this.resolve(row);
      return resolved.skip_reason ?? null;
    }
    return null;
  }
}
