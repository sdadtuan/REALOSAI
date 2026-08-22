import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

const WIN2_MOBILE_ROUTES = [
  '/',
  '/crm/staff',
  '/crm/payroll',
  '/crm/kpi',
  '/crm/kpi/solution',
  '/admin/crm/org/users',
  '/admin/crm/org/chart',
] as const;

/**
 * WIN-2 W2-FE-29 — Mobile regression on WIN-2 touched routes (390px).
 */
test.describe('WIN-2 mobile regression', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  for (const path of WIN2_MOBILE_ROUTES) {
    test(`${path} loads without 5xx on mobile`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status() ?? 0).toBeLessThan(500);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('pre')).toHaveCount(0);
    });
  }
});
