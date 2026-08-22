import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('Admin Control Plane P2 HR bridge', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('roster shows identity callout and onboard deep link', async ({ page }) => {
    await page.goto('/crm/staff');
    await expect(page.getByRole('note')).toContainText('khác tài khoản đăng nhập', {
      timeout: 15_000,
    });

    const onboard = page.getByRole('link', { name: 'Onboard' }).first();
    if ((await onboard.count()) === 0) {
      test.skip(true, 'No roster rows without login account');
    }

    await onboard.click();
    await expect(page).toHaveURL(/\/admin\/crm\/org\/users\/new\?/);
    await expect(page.getByText(/Đang onboard từ hồ sơ roster|Onboard nhân viên/)).toBeVisible();
  });
});
