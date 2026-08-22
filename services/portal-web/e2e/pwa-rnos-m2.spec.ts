import { test, expect } from '@playwright/test';

const PORTAL_URL = (process.env.PORTAL_E2E_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
const APPROVER_EMAIL = process.env.PORTAL_E2E_APPROVER_EMAIL ?? 'approver@demo.local';
const APPROVER_PASSWORD = process.env.PORTAL_E2E_APPROVER_PASSWORD ?? 'demo123';

async function loginAsApprover(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(APPROVER_EMAIL);
  await page.getByLabel(/mật khẩu|password/i).fill(APPROVER_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập|login/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('RNOS-M2 Portal PWA', () => {
  test('manifest and service worker are served', async ({ request }) => {
    const manifest = await request.get(`${PORTAL_URL}/manifest.webmanifest`);
    expect(manifest.ok()).toBeTruthy();
    const manifestBody = await manifest.text();
    expect(manifestBody).toContain('PTT Portal');

    const sw = await request.get(`${PORTAL_URL}/sw.js`);
    expect(sw.ok()).toBeTruthy();
    const swBody = await sw.text();
    expect(swBody).toContain('ptt-portal-pwa-v1');
  });

  test('mobile bottom nav visible on narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsApprover(page);
    await expect(page.locator('.portal-mobile-bottom-nav')).toBeVisible();
    await expect(page.locator('.portal-mobile-bottom-nav__item')).toHaveCount(4);
  });

  test('creative inbox exposes swipe wrapper @ mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsApprover(page);
    await page.goto('/creatives');
    const swipe = page.getByTestId('portal-approval-swipe-card');
    if ((await swipe.count()) === 0) {
      test.skip(true, 'No pending creatives in fixture');
    }
    await expect(swipe.first()).toBeVisible({ timeout: 20_000 });
  });
});
