import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * WIN-2 VUX-03 — HR onboard wizard (4 steps, ≤15 ph budget in manual UAT).
 */
test.describe('WIN-2 VUX-03 onboard wizard', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('org users/new shows WinWizardSteps and step labels', async ({ page }) => {
    await page.goto('/admin/crm/org/users/new');
    await expect(page.getByRole('heading', { name: /onboard nhân viên/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Hồ sơ/i)).toBeVisible();
    await expect(page.getByText(/Quyền/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Tiếp$/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('wizard advances through access step', async ({ page }) => {
    await page.goto('/admin/crm/org/users/new');
    await page.getByLabel(/Họ tên/i).fill('WIN2 UAT NV');
    await page.getByLabel(/Chức danh/i).selectOption({ index: 1 });
    await page.getByRole('button', { name: /^Tiếp$/i }).click();
    await expect(page.getByText(/Chức danh đã chọn/i)).toBeVisible({ timeout: 10_000 });
  });
});
