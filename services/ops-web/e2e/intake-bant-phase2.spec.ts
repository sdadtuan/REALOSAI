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

/**
 * INT-P2-19 — Khảo sát BANT Phase 2: câu trả lời từng câu, red flags, stakeholder, cam kết.
 */
test.describe('INT-P2-19 Intake BANT Phase 2', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('structured discovery answers, red flags, stakeholder, complete', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const stamp = Date.now();

    await openIntakeForLead(page, leadId);
    await createPhoneSession(page);
    await fillDiscoveryBasics(
      page,
      `E2E P2 ${stamp}`,
      `Pain E2E Phase2 ${stamp} — cần SEO và lead inbound.`,
    );
    await tickDiscoveryChecklist(page, 8);

    const firstAnswer = page.locator('.intake-discovery-checklist__answer-input').first();
    await expect(firstAnswer).toBeVisible({ timeout: 10_000 });
    await firstAnswer.fill(`Trả lời E2E ${stamp}`);

    await page.locator('.intake-red-flags-section summary').click();
    const redFlag = page.locator('.intake-red-flags-section__item input[type=checkbox]').first();
    await redFlag.check();

    const dmName = page.locator('.intake-stakeholder-table__row input').first();
    await dmName.fill(`Decision Maker ${stamp}`);

    await scoreBant(page, 4);
    await selectDecision(page, 'go');
    await completeIntakeSession(page);
  });
});
