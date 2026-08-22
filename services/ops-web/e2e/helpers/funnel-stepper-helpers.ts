import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, staffToken } from './ai-copilot-helpers';
import {
  completeIntakeSession,
  createPhoneSession,
  fillDiscoveryBasics,
  fetchLatestIntakeSession,
  scoreBant,
  selectDecision,
  tickDiscoveryChecklist,
} from './intake-bant-helpers';

export interface LeadFunnelApiSnapshot {
  lead_flow_kind?: string;
  presales_on_lead_enabled?: boolean;
  care_pipeline?: { all_complete?: boolean };
  review_queue?: { active?: boolean };
  presales?: {
    presales?: { id?: number; stage?: string; service_slug?: string };
  } | null;
}

export function funnelStepper(page: Page) {
  return page.getByRole('navigation', { name: 'Funnel pre-sales' });
}

export async function fetchLeadFunnelApi(
  request: APIRequestContext,
  leadId: number,
): Promise<LeadFunnelApiSnapshot> {
  const token = await staffToken(request);
  const res = await request.get(`${API_URL}/api/v1/leads/${leadId}/funnel`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `fetch funnel: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as LeadFunnelApiSnapshot;
}

export async function submitB2ContactOkReport(
  request: APIRequestContext,
  leadId: number,
): Promise<void> {
  const token = await staffToken(request);
  const res = await request.post(`${API_URL}/api/v1/leads/${leadId}/care-pipeline/report`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: {
      stage: 'first_contact',
      content: 'E2E B2 contact OK report',
      care_status: 'da_lien_he_thanh_cong',
      care_contact_type: 'goi_dien',
    },
  });
  expect(res.ok(), `B2 report: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export async function completeB2StageApi(request: APIRequestContext, leadId: number): Promise<void> {
  const funnel = await fetchLeadFunnelApi(request, leadId);
  if (funnel.care_pipeline?.all_complete) return;

  if (!funnel.care_pipeline?.all_complete) {
    await submitB2ContactOkReport(request, leadId);
  }

  const token = await staffToken(request);
  const res = await request.post(`${API_URL}/api/v1/leads/${leadId}/care-pipeline/complete`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { stage: 'first_contact', note: 'E2E B2 complete note' },
  });
  expect(res.ok(), `B2 complete: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export async function ensurePresalesApi(
  request: APIRequestContext,
  leadId: number,
  serviceSlug = 'dich-vu-seo-tong-the',
): Promise<LeadFunnelApiSnapshot> {
  const token = await staffToken(request);
  const funnel = await fetchLeadFunnelApi(request, leadId);
  if (funnel.presales?.presales) {
    return funnel;
  }

  const res = await request.post(`${API_URL}/api/v1/leads/${leadId}/presales`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { service_slug: serviceSlug },
  });
  expect(res.ok(), `ensure presales: ${res.status()} ${await res.text()}`).toBeTruthy();
  return fetchLeadFunnelApi(request, leadId);
}

export async function setupPresalesLeadStage(
  request: APIRequestContext,
  leadId: number,
): Promise<{ ok: true; funnel: LeadFunnelApiSnapshot } | { ok: false; reason: string }> {
  await completeB2StageApi(request, leadId);
  const funnel = await ensurePresalesApi(request, leadId);

  if (!funnel.presales_on_lead_enabled) {
    return { ok: false, reason: 'presales_on_lead disabled on API' };
  }
  if (funnel.lead_flow_kind === 'spa_operational') {
    return { ok: false, reason: 'lead is spa_operational — not B2B presales flow' };
  }
  if (funnel.review_queue?.active) {
    return { ok: false, reason: 'lead in review queue' };
  }

  const stage = funnel.presales?.presales?.stage;
  if (stage && stage !== 'lead') {
    return { ok: false, reason: `presales stage is ${stage} — need lead stage (OPS_E2E_AI_LEAD_ID)` };
  }

  return { ok: true, funnel };
}

export async function fillDecisionReason(page: Page, reason: string): Promise<void> {
  const input = page.locator('.intake-bant-decision-pane input.kpi-input');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(reason);
}

export async function completeIntakeGoSession(page: Page, stamp: number): Promise<void> {
  await createPhoneSession(page);
  await fillDiscoveryBasics(
    page,
    `E2E Stepper ${stamp}`,
    `Pain E2E stepper ${stamp} — cần tư vấn SEO.`,
  );
  await tickDiscoveryChecklist(page, 8);
  await scoreBant(page, 4);
  await selectDecision(page, 'go');
  await completeIntakeSession(page);
}

export async function waitForConsultAdvanceCta(page: Page): Promise<void> {
  const stepper = funnelStepper(page);
  await expect(stepper).toBeVisible({ timeout: 20_000 });
  await expect(stepper.locator('.intake-gate-banner--ok')).toBeVisible({ timeout: 20_000 });
  await expect(stepper.getByRole('button', { name: /Chuyển → Tư vấn/i })).toBeEnabled({
    timeout: 20_000,
  });
}

export async function clickConsultAdvanceFromStepper(page: Page, acceptConfirm = false): Promise<void> {
  if (acceptConfirm) {
    page.once('dialog', (dialog) => void dialog.accept());
  }
  await funnelStepper(page).getByRole('button', { name: /Chuyển → Tư vấn/i }).click();
}

export async function hasCompletedIntakeSession(
  request: APIRequestContext,
  leadId: number,
): Promise<boolean> {
  const latest = await fetchLatestIntakeSession(request, leadId);
  return latest?.status === 'completed';
}

/** Advance presales to consult via API (for consult-workspace e2e). */
export async function advanceLeadPresalesToConsult(
  request: APIRequestContext,
  leadId: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const token = await staffToken(request);
  let funnel = await fetchLeadFunnelApi(request, leadId);
  const stage = funnel.presales?.presales?.stage;
  if (stage === 'consult' || stage === 'proposal') {
    return { ok: true };
  }
  if (stage !== 'lead') {
    return { ok: false, reason: `presales stage is ${stage ?? 'missing'} — need lead` };
  }

  const res = await request.post(`${API_URL}/api/v1/leads/${leadId}/presales/advance`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { confirm: true },
  });
  if (!res.ok()) {
    return { ok: false, reason: `advance: ${res.status()} ${(await res.text()).slice(0, 200)}` };
  }

  funnel = await fetchLeadFunnelApi(request, leadId);
  if (funnel.presales?.presales?.stage === 'consult') {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `after advance stage=${funnel.presales?.presales?.stage ?? 'none'} (need intake Go + lead tasks)`,
  };
}
