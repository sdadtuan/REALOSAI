import { test, expect } from '@playwright/test';

const APPROVER_EMAIL = process.env.PORTAL_E2E_APPROVER_EMAIL ?? 'approver@demo.local';
const APPROVER_PASSWORD = process.env.PORTAL_E2E_APPROVER_PASSWORD ?? 'demo123';
const API_URL = (process.env.PORTAL_E2E_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

async function loginAsApprover(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(APPROVER_EMAIL);
  await page.getByLabel(/mật khẩu|password/i).fill(APPROVER_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập|login/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function apiReachable(request: import('@playwright/test').APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(`${API_URL}/api/v1/ai/health`);
    return res.ok();
  } catch {
    return false;
  }
}

/**
 * RNOS-30 / UI-R3-07 — Portal AI weekly report summary on dashboard.
 */
test.describe('RNOS-30 Portal AI summary', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest portal API not reachable');
  });

  test('dashboard shows client-safe AI summary card when enabled', async ({ page }) => {
    await loginAsApprover(page);
    await expect(page.getByRole('heading', { name: 'Tuần này', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('portal-ai-summary-block')).toBeVisible();
    await expect(page.locator('.portal-ai-summary__narrative')).not.toBeEmpty();
    await expect(page.getByText(/client-safe/i)).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });
});
