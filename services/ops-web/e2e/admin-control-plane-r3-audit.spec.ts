import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('Admin Control Plane R3 audit', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('hub reaches audit center via compliance workspace', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('link', { name: /Audit Center/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/audit/);
    await expect(page.getByRole('heading', { name: 'Audit Center' })).toBeVisible();
  });

  test('permissions page links to full audit timeline', async ({ page }) => {
    await page.goto('/admin/crm/permissions');
    await page.getByRole('link', { name: /Xem toàn bộ audit/i }).click();
    await expect(page).toHaveURL(/\/admin\/audit\?category=permission_matrix/);
  });

  test('audit filter bar renders', async ({ page }) => {
    await page.goto('/admin/audit');
    await expect(page.getByLabel('Lọc actor')).toBeVisible();
    await expect(page.getByLabel('Loại sự kiện')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  });
});
