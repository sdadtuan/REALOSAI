import { test, expect } from '@playwright/test';
import { loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  completeIntakeSession,
  createPhoneSession,
  fillDiscoveryBasics,
  nestApiReachable,
  openIntakeForLead,
  resolveIntakeLeadId,
  scoreBant,
  selectDecision,
  tickDiscoveryChecklist,
} from './helpers/intake-bant-helpers';
import {
  clickConsultAdvanceFromStepper,
  completeIntakeGoSession,
  fetchLeadFunnelApi,
  fillDecisionReason,
  funnelStepper,
  hasCompletedIntakeSession,
  setupPresalesLeadStage,
  waitForConsultAdvanceCta,
} from './helpers/funnel-stepper-helpers';

/**
 * INT-P25-18 — Funnel stepper Phase 2.5 (Intake + Lead handoff Consult).
 * UAT U1–U7 from spec INT-P25-20260805.
 *
 * Run: bash scripts/playwright_ops_intake_bant_phase25_e2e.sh
 * U2 mutates presales → consult — kept last. Bootstrap resets lead fixture before suite.
 */
test.describe('INT-P25-18 Funnel stepper Phase 2.5', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('U4 presales lead without completed intake prompts create session CTA', async ({
    page,
    request,
  }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    if (await hasCompletedIntakeSession(request, leadId)) {
      test.skip(true, 'Lead already has completed intake — run intake_bant_phase25_e2e_bootstrap.sh');
    }

    await openIntakeForLead(page, leadId);
    const stepper = funnelStepper(page);
    await expect(stepper).toBeVisible({ timeout: 20_000 });
    await expect(stepper.getByRole('button', { name: /Tạo phiên Intake/i })).toBeVisible();
  });

  test('U1 Intake Go BANT≥24 shows gate OK and enabled Chuyển → Tư vấn CTA', async ({
    page,
    request,
  }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    const stamp = Date.now();
    await openIntakeForLead(page, leadId);
    await completeIntakeGoSession(page, stamp);
    await waitForConsultAdvanceCta(page);

    const stepper = funnelStepper(page);
    await expect(stepper.locator('.intake-gate-banner--ok')).toContainText(/Sẵn sàng chuyển Tư vấn/i);
    await expect(stepper.locator('.intake-gate-banner__meta')).toContainText(/BANT 24\/30/i);
  });

  test('U3 Nurture decision shows confirm on advance CTA', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    const stamp = Date.now();
    await openIntakeForLead(page, leadId);
    await createPhoneSession(page);
    await fillDiscoveryBasics(page, `E2E Nurture ${stamp}`, `Need nurture ${stamp}`);
    await tickDiscoveryChecklist(page, 8);
    await scoreBant(page, 4);
    await selectDecision(page, 'nurture');
    await fillDecisionReason(page, `E2E nurture reason ${stamp}`);
    await completeIntakeSession(page);

    const stepper = funnelStepper(page);
    await expect(stepper).toBeVisible({ timeout: 20_000 });
    await expect(stepper.locator('.intake-gate-banner--warn')).toBeVisible({ timeout: 20_000 });
    await expect(
      stepper.getByRole('button', { name: /Chuyển → Tư vấn \(xác nhận\)/i }),
    ).toBeEnabled({ timeout: 20_000 });

    await Promise.all([
      page.waitForEvent('dialog').then(async (dialog) => {
        expect(dialog.message()).toMatch(/Nurture|cân nhắc|Xác nhận/i);
        await dialog.dismiss();
      }),
      stepper.getByRole('button', { name: /Chuyển → Tư vấn \(xác nhận\)/i }).click(),
    ]);
  });

  test('U5 Lead detail shows same funnel stepper track after Intake Go', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    const stamp = Date.now();
    await openIntakeForLead(page, leadId);
    await completeIntakeGoSession(page, stamp);
    await waitForConsultAdvanceCta(page);

    await page.goto(`/crm/leads/${leadId}`);
    await expect(page.locator('.lead-detail-page')).toContainText(`#${leadId}`, { timeout: 20_000 });

    const stepper = funnelStepper(page);
    await expect(stepper).toBeVisible({ timeout: 20_000 });
    await expect(stepper.getByRole('list', { name: 'Tiến trình pre-sales lead' })).toBeVisible();
    await expect(stepper.getByRole('link', { name: 'Khảo sát BANT' })).toBeVisible();
    await expect(stepper.locator('.intake-gate-banner--ok')).toBeVisible({ timeout: 20_000 });
  });

  test('U6 review queue hides primary advance CTA on Intake stepper', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const funnel = await fetchLeadFunnelApi(request, leadId);
    if (!funnel.review_queue?.active) {
      test.skip(true, 'Lead not in review queue — manual GDKD queue setup required for U6');
    }

    await openIntakeForLead(page, leadId);
    const stepper = funnelStepper(page);
    await expect(stepper).toBeVisible({ timeout: 20_000 });
    await expect(stepper.getByText(/Phải tra soát/i)).toBeVisible();
    await expect(stepper.getByRole('button', { name: /Chuyển → Tư vấn/i })).toHaveCount(0);
  });

  test('U7 mobile Intake stepper track scrolls and sticky CTA @390px', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    await page.setViewportSize({ width: 390, height: 844 });
    await openIntakeForLead(page, leadId);
    await waitForConsultAdvanceCta(page);

    const stepper = funnelStepper(page);
    const track = stepper.locator('.crm-funnel-stepper__track');
    await expect(track).toBeVisible();
    const trackBox = await track.boundingBox();
    expect(trackBox).toBeTruthy();

    const ctaBar = stepper.locator('.crm-funnel-stepper__cta-bar--sticky');
    await expect(ctaBar).toBeVisible();
    const ctaBox = await ctaBar.boundingBox();
    expect(ctaBox).toBeTruthy();
    if (ctaBox) {
      expect(ctaBox.y + ctaBox.height).toBeLessThanOrEqual(844 + 4);
    }
  });

  test('U2 advance Consult from Intake navigates to Lead #funnel-presales', async ({
    page,
    request,
  }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    const stamp = Date.now();
    await openIntakeForLead(page, leadId);
    await completeIntakeGoSession(page, stamp);
    await waitForConsultAdvanceCta(page);
    await clickConsultAdvanceFromStepper(page);

    await expect(page).toHaveURL(new RegExp(`/crm/leads/${leadId}#funnel-presales`), {
      timeout: 25_000,
    });
    await expect(page.locator('#funnel-presales')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#funnel-presales')).toContainText(/consult/i);

    const funnel = await fetchLeadFunnelApi(request, leadId);
    expect(funnel.presales?.presales?.stage).toBe('consult');
  });
});
