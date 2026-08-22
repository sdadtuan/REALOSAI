import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

async function expandSidebarIfNeeded(page: import('@playwright/test').Page) {
  const expand = page.getByRole('button', { name: /Mở rộng menu|»/ }).first();
  if (await expand.isVisible()) {
    await expand.click();
  }
}

test.describe('Admin Control Plane a11y', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('admin hub has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Quản trị hệ thống' })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toHaveLength(0);
  });

  test('permissions page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/admin/crm/permissions');
    await expect(page.getByRole('heading').first()).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toHaveLength(0);
  });

  test('org users page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/admin/crm/org/users');
    await expect(page.getByRole('heading', { name: /Nhân viên/i })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toHaveLength(0);
  });
});

test.describe('Admin Control Plane P3 onboard', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('sidebar to onboard wizard four steps', async ({ page }) => {
    await page.goto('/');
    await expandSidebarIfNeeded(page);
    await expect(page.getByText('Quản trị hệ thống').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Trung tâm quản trị' }).click();
    await expect(page).toHaveURL(/\/admin\/?$/);

    await page.getByRole('link', { name: /Onboard/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/crm\/org\/users\/new/);

    await expect(page.getByText('Hồ sơ', { exact: true })).toBeVisible();
    await expect(page.getByText('Quyền', { exact: true })).toBeVisible();
    await expect(page.getByText('Tài khoản', { exact: true })).toBeVisible();
    await expect(page.getByText('UAT', { exact: true })).toBeVisible();
  });

  test('global search admin filter finds onboard route', async ({ page }) => {
    await page.goto('/crm/leads');
    await page.locator('.global-search-input').fill('onboard');
    await page.getByRole('button', { name: 'Quản trị' }).click();
    await expect(page.locator('.global-search-hit--admin').first()).toBeVisible({ timeout: 5000 });
  });

  test('mobile drawer opens on org users page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin/crm/org/users');
    await page.getByRole('button', { name: 'Menu quản trị' }).click();
    await expect(page.getByRole('link', { name: 'Người dùng' }).first()).toBeVisible();
  });
});
