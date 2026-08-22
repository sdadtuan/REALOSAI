import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * WIN-2 VUX-07 — KPI Solution dashboard + team toggle.
 */
test.describe('WIN-2 VUX-07 KPI solution', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/kpi has team toggle', async ({ page }) => {
    await page.goto('/crm/kpi');
    await expect(page.locator('.kpi-team-toggle')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Solution' }).click();
    await expect(page.getByRole('button', { name: 'Solution' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('/crm/kpi/solution shows solution dashboard tiles', async ({ page }) => {
    await page.goto('/crm/kpi/solution');
    await expect(page.getByRole('heading', { name: /KPI Solution & Pre-sales/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.kpi-tile-grid, .kpi-sla-tile-grid')).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });
});
