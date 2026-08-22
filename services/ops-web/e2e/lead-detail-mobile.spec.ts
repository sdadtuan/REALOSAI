import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  loginAsStaff,
  resolveLeadId,
} from './helpers/ai-copilot-helpers';

async function nestApiReachable(request: APIRequestContext): Promise<boolean> {
  const apiUrl = (process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
  try {
    const health = await request.get(`${apiUrl}/health`, { timeout: 8_000 });
    return health.ok();
  } catch {
    return false;
  }
}

/**
 * SCR-MOB-003 — Lead detail mobile closeout (tabs, tel:, offline copilot banner).
 */
async function clickAiTab(page: import('@playwright/test').Page) {
  const aiTab = page.locator('.lead-detail-tabs').getByRole('tab', { name: 'AI' });
  await aiTab.scrollIntoViewIfNeeded();
  await aiTab.evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(aiTab).toHaveAttribute('aria-selected', 'true');
}

test.describe('SCR-MOB-003 Lead detail mobile', () => {
  test('mobile tabs Chi tiết / Hoạt động / AI @390px', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');

    const leadId = await resolveLeadId(request);
    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/crm/leads/${leadId}`);

    await expect(page.locator('.lead-detail-page')).toContainText(`#${leadId}`, { timeout: 20_000 });
    const tabs = page.locator('.lead-detail-tabs');
    if ((await tabs.count()) === 0) {
      test.skip(true, 'Copilot disabled — tab bar hidden');
    }
    await expect(tabs).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Chi tiết' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Hoạt động' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'AI' })).toBeVisible();
  });

  test('tel: Gọi link when lead has phone', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');

    const leadId = await resolveLeadId(request);
    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/crm/leads/${leadId}`);
    await expect(page.locator('[data-testid=lead-contact-copy]')).toBeVisible({ timeout: 20_000 });

    const callLink = page.locator('[data-testid=lead-contact-call]');
    if ((await callLink.count()) === 0) {
      test.skip(true, 'Lead has no phone in fixture');
    }
    await expect(callLink).toHaveAttribute('href', /^tel:/);
  });

  test('AI tab opens bottom sheet copilot @390px', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');

    const leadId = await resolveLeadId(request);
    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/crm/leads/${leadId}`);

    if ((await page.locator('.lead-detail-tabs').count()) === 0) {
      test.skip(true, 'Copilot tab hidden');
    }
    await clickAiTab(page);
    await expect(page.getByTestId('lead-copilot-bottom-sheet')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.lead-detail-page--copilot-sheet')).toBeVisible();
  });

  test('AI tab shows copilot trust footer when online', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');

    const leadId = await resolveLeadId(request);
    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/crm/leads/${leadId}`);

    if ((await page.locator('.lead-detail-tabs').count()) === 0) {
      test.skip(true, 'Copilot tab hidden');
    }
    await clickAiTab(page);
    await expect(page.getByTestId('copilot-trust-footer')).toBeVisible({ timeout: 20_000 });
  });

  test('offline shows copilot network banner on AI tab', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');

    const leadId = await resolveLeadId(request);
    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/crm/leads/${leadId}`);
    await expect(page.locator('.lead-detail-page')).toContainText(`#${leadId}`, { timeout: 20_000 });

    if ((await page.locator('.lead-detail-tabs').count()) === 0) {
      test.skip(true, 'Copilot tab hidden');
    }

    await clickAiTab(page);
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByTestId('copilot-offline-banner')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('copilot-offline-banner')).toContainText(/Copilot cần kết nối mạng/);
    await page.context().setOffline(false);
  });
});

test.describe('SCR-MOB-003 Lead detail tablet', () => {
  test('tablet FAB opens copilot drawer @1100px', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');

    const leadId = await resolveLeadId(request);
    await loginAsStaff(page);
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto(`/crm/leads/${leadId}`);
    await expect(page.locator('.lead-detail-page')).toContainText(`#${leadId}`, { timeout: 20_000 });

    const fab = page.locator('.lead-copilot-fab');
    if ((await fab.count()) === 0) {
      test.skip(true, 'Copilot FAB hidden (flag off or desktop breakpoint)');
    }
    await fab.scrollIntoViewIfNeeded();
    await fab.click({ force: true });
    await expect(page.getByRole('complementary', { name: 'AI Copilot' })).toBeVisible();
  });
});
