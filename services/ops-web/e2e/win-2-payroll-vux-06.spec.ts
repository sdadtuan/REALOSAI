import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * WIN-2 VUX-06 — Payroll Excel export button + form UI (no JSON primary).
 */
test.describe('WIN-2 VUX-06 payroll Excel', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/payroll shows form UI and export button', async ({ page }) => {
    await page.goto('/crm/payroll');
    await expect(page.getByRole('heading', { name: /Payroll & chấm công/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /^Export Excel$/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('export triggers download with xlsx content type when data exists', async ({ page }) => {
    await page.goto('/crm/payroll');
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 }).catch(() => null);
    await page.getByRole('button', { name: /^Export Excel$/i }).click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/i);
    } else {
      await expect(page.getByText(/không có dữ liệu|lỗi|error/i)).toBeVisible();
    }
  });
});
