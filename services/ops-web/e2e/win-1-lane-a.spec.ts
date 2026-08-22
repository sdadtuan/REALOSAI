import { test, expect } from '@playwright/test';

const OPS = process.env.OPS_E2E_URL ?? 'http://127.0.0.1:3200';

test.describe('WIN-1 Lane A smoke', () => {
  test('login page loads', async ({ page }) => {
    const res = await page.goto(`${OPS}/login`);
    expect(res?.ok()).toBeTruthy();
  });

  test('admin permissions routes exist (redirect unauth ok)', async ({ page }) => {
    for (const path of [
      '/admin/crm/permissions',
      '/admin/crm/permissions/functions',
      '/admin/crm/permissions/users',
    ]) {
      const res = await page.goto(`${OPS}${path}`);
      expect(res?.status()).toBeLessThan(500);
    }
  });

  test('crm leads page shell', async ({ page }) => {
    const res = await page.goto(`${OPS}/crm/leads`);
    expect(res?.status()).toBeLessThan(500);
  });
});
