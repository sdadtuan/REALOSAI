import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * RNOS-43B — Financials dashboard v2 (tiles, sortable lifecycle, drill, ERP footer).
 */
test.describe('RNOS-43B Financials dashboard v2', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/financials shows dashboard shell, 5 tiles, ERP footer', async ({ page }) => {
    await page.goto('/crm/financials');
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.kpi-tile-grid .kpi-tile')).toHaveCount(5);
    await expect(page.getByText(/không thay ERP MISA/i)).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('lifecycle table supports sort headers and service-delivery links', async ({ page }) => {
    await page.goto('/crm/financials');
    await expect(page.locator('.financials-lifecycle-table')).toBeVisible({ timeout: 20_000 });
    await page.locator('.financials-lifecycle-table th').filter({ hasText: /Margin/i }).click();
    const link = page.locator('.financials-lifecycle-table a[href*="/crm/service-delivery/"]').first();
    if (await link.count()) {
      await expect(link).toBeVisible();
    }
  });

  test('AR aging chart section visible', async ({ page }) => {
    await page.goto('/crm/financials');
    await expect(page.getByRole('heading', { name: /ar aging/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.kpi-bar-chart')).toBeVisible();
  });
});
