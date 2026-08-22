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
 * INT-P1-19 — Khảo sát BANT Phase 1 smoke: tạo phiên → checklist + BANT → complete.
 */
test.describe('INT-P1-19 Intake BANT Phase 1', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('create phone session, score BANT, and complete', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    const stamp = Date.now();

    await openIntakeForLead(page, leadId);
    await createPhoneSession(page);
    await fillDiscoveryBasics(
      page,
      `E2E Intake ${stamp}`,
      `Pain point E2E ${stamp} — cần SEO tổng thể và tăng lead inbound.`,
    );
    await tickDiscoveryChecklist(page, 8);
    await scoreBant(page, 4);
    await selectDecision(page, 'go');
    await completeIntakeSession(page);
  });

  test('mobile sticky actions stay visible @390px', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    await page.setViewportSize({ width: 390, height: 844 });

    await openIntakeForLead(page, leadId);

    const stickyBar = page.locator('.intake-form-actions__sticky');
    await expect(stickyBar).toBeHidden();

    await createPhoneSession(page);
    await expect(stickyBar).toBeVisible();
    await expect(stickyBar.getByRole('button', { name: 'Lưu nháp' })).toBeVisible();
    await expect(stickyBar.getByRole('button', { name: 'Hoàn thành phiên' })).toBeVisible();

    await stickyBar.scrollIntoViewIfNeeded();
    const box = await stickyBar.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.y + box.height).toBeLessThanOrEqual(844 + 2);
    }
  });

  test('AI summary panel shows empty state on draft session', async ({ page, request }) => {
    const leadId = await resolveIntakeLeadId(request);
    await openIntakeForLead(page, leadId);
    await createPhoneSession(page);

    await expect(page.getByRole('heading', { level: 2, name: /D\. AI tóm tắt/i })).toBeVisible();
    await expect(page.getByText(/Chưa có tóm tắt AI/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tóm tắt AI' })).toBeVisible();
  });
});
