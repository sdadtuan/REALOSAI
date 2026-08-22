import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * RNOS-35 — CRM custom fields + pipeline admin smoke.
 */
test.describe('RNOS-35 CRM config admin', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/admin/crm/custom-fields shows table and create form', async ({ page }) => {
    await page.goto('/admin/crm/custom-fields');
    await expect(page.getByRole('heading', { level: 2, name: /custom fields/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.admin-crm-subnav')).toBeVisible();
    await expect(page.locator('.perf-table')).toBeVisible();
    await expect(page.locator('.admin-hubspot-layout')).toBeVisible();
    await expect(page.getByRole('button', { name: /thêm field/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('/admin/crm/pipeline shows stage editor', async ({ page }) => {
    await page.goto('/admin/crm/pipeline');
    await expect(page.getByRole('heading', { level: 2, name: /pipeline sales/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.admin-pipeline-list .admin-pipeline-row')).not.toHaveCount(0);
    await expect(page.getByRole('button', { name: /lưu pipeline/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });
});
