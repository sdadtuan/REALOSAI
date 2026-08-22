import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginAsStaff } from './helpers/ai-copilot-helpers';

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
 * SCR-MOB-004 — CSKH board mobile card list @ ≤768px.
 */
test.describe('SCR-MOB-004 CSKH board mobile', () => {
  test('mobile viewport shows cards and hides table', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable — start ptt-crm-api for auth');

    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/crm/cskh-board');

    await expect(page.locator('.page-content h1')).toContainText('SLA first call', { timeout: 20_000 });
    await expect(page.locator('.cskh-board-summary-chips')).toBeVisible();
    await expect(page.locator('.cskh-board-cards')).toBeVisible();
    await expect(page.locator('.cskh-board-table-wrap')).toBeHidden();
    await expect(page.locator('.cskh-board-filter-accordion')).toBeVisible();
  });

  test('SLA summary chips preset warning filter', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');

    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/crm/cskh-board');
    await expect(page.locator('.cskh-board-summary-chips')).toBeVisible({ timeout: 20_000 });

    const warningChip = page.locator('.cskh-board-summary-chip--warn');
    await warningChip.click();
    await expect(warningChip).toHaveClass(/is-active/, { timeout: 20_000 });
  });

  test('card link targets lead detail when rows exist', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');

    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/crm/cskh-board');
    await expect(page.locator('.cskh-board-cards')).toBeVisible({ timeout: 20_000 });

    const cardLink = page.locator('.cskh-board-card__link').first();
    if ((await cardLink.count()) === 0) {
      test.skip(true, 'No CSKH rows in fixture DB');
    }
    await expect(cardLink).toHaveAttribute('href', /\/crm\/leads\/\d+/);
  });
});

test.describe('SCR-MOB-004 CSKH board desktop', () => {
  test('desktop viewport shows table and hides cards', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable');

    await loginAsStaff(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/crm/cskh-board');

    await expect(page.locator('.page-content h1')).toContainText('SLA first call', { timeout: 20_000 });
    await expect(page.locator('.cskh-board-table-wrap')).toBeVisible();
    await expect(page.locator('.cskh-board-cards')).toBeHidden();
    await expect(page.locator('.cskh-board-filters-desktop')).toBeVisible();
  });
});
