import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('Admin Control Plane nav', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('sidebar hub reaches org users via left rail', async ({ page }) => {
    await page.goto('/');
    const expand = page.getByRole('button', { name: /Mở rộng menu|»/ }).first();
    if (await expand.isVisible()) {
      await expand.click();
    }
    await expect(page.getByText('Quản trị hệ thống').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Trung tâm quản trị' }).click();
    await expect(page).toHaveURL(/\/admin\/?$/);
    await page.getByRole('link', { name: 'Người dùng' }).first().click();
    await expect(page).toHaveURL(/\/admin\/crm\/org\/users/);
    await expect(page.getByRole('heading', { name: /Nhân viên/i })).toBeVisible();
  });
});
