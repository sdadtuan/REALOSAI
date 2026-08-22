import { test, expect } from '@playwright/test';
import { loginAsStaff } from './helpers/ai-copilot-helpers';
import {
  advanceLeadPresalesToConsult,
  fetchLeadFunnelApi,
  setupPresalesLeadStage,
} from './helpers/funnel-stepper-helpers';
import { nestApiReachable, resolveIntakeLeadId } from './helpers/intake-bant-helpers';

/**
 * P2-C3-06 — Consult workspace tab (E1).
 * Run: cd services/ops-web && npx playwright test e2e/consult-workspace.spec.ts
 */
test.describe('P2 Consult workspace tab', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('U1 tab Tư vấn visible when presales @ consult', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    const advanced = await advanceLeadPresalesToConsult(request, leadId);
    if (!advanced.ok) test.skip(true, advanced.reason);

    await page.goto(`/crm/leads/${leadId}`);
    const consultTab = page.getByRole('tab', { name: 'Tư vấn' });
    await expect(consultTab).toBeVisible({ timeout: 20_000 });
    await consultTab.click();
    await expect(page.getByTestId('lead-consult-workspace')).toBeVisible();
    await expect(page.locator('#funnel-presales')).toBeVisible();
  });

  test('hash #funnel-presales opens consult workspace', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const setup = await setupPresalesLeadStage(request, leadId);
    if (!setup.ok) test.skip(true, setup.reason);

    const advanced = await advanceLeadPresalesToConsult(request, leadId);
    if (!advanced.ok) test.skip(true, advanced.reason);

    await page.goto(`/crm/leads/${leadId}${'#funnel-presales'}`);
    await expect(page.getByTestId('lead-consult-workspace')).toBeVisible({ timeout: 20_000 });

    const funnel = await fetchLeadFunnelApi(request, leadId);
    expect(funnel.presales?.presales?.stage).toMatch(/consult|proposal/);
  });
});
