/**
 * RNOS-M3 Phase 2 — Store screenshot capture (Playwright)
 * Run via: bash ../../scripts/m3_store_screenshots_capture.sh
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR =
  process.env.M3_SCREENSHOT_OUT_DIR ??
  path.resolve(__dirname, '../../../mobile-shell/store-assets/screenshots/ios');

const APPROVER_EMAIL = process.env.PORTAL_E2E_APPROVER_EMAIL ?? 'approver@demo.local';
const APPROVER_PASSWORD = process.env.PORTAL_E2E_APPROVER_PASSWORD ?? 'demo123';

const VIEWPORTS = {
  iphone_6_7: { width: 430, height: 932, prefix: 'iphone-6.7' },
  iphone_5_5: { width: 414, height: 736, prefix: 'iphone-5.5' },
  ipad_13: { width: 1032, height: 1376, prefix: 'ipad-13' },
} as const;

async function loginAsApprover(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(APPROVER_EMAIL);
  await page.getByLabel(/mật khẩu|password/i).fill(APPROVER_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập|login/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

type ViewportKey = keyof typeof VIEWPORTS;

async function capture(page: Page, route: string, slug: string, key: ViewportKey) {
  const vp = VIEWPORTS[key];
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${vp.prefix}-${slug}.png`);
  await page.screenshot({ path: file, fullPage: false });
}

test.describe('M3 store screenshots', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  for (const key of Object.keys(VIEWPORTS) as ViewportKey[]) {
    test(`capture ${key}`, async ({ page }) => {
      await loginAsApprover(page);
      await capture(page, '/dashboard', '01-dashboard', key);
      await capture(page, '/creatives', '02-creatives', key);
      await capture(page, '/notifications', '03-notifications', key);
      await capture(page, '/settings', '04-settings-push', key);
    });
  }
});
