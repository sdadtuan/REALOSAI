import { test, expect, type APIRequestContext } from '@playwright/test';
import { loginAsStaff } from './helpers/ai-copilot-helpers';

async function nestApiReachable(request: APIRequestContext): Promise<boolean> {
  const apiUrl = (process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
  try {
    const health = await request.get(`${apiUrl}/health`, { timeout: 8_000 });
    return health.ok();
  } catch {
    return false;
  }
}

test.describe('E5 home CSKH widgets', () => {
  test('home dashboard shows SLA widgets and links to CSKH board', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable — start ptt-crm-api for auth');

    await loginAsStaff(page);
    await page.goto('/');

    await expect(page.getByTestId('home-cskh-widgets')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/SLA breach/i)).toBeVisible();
    await expect(page.getByText(/Review queue/i)).toBeVisible();

    await page.getByRole('link', { name: /Bảng CSKH SLA/i }).click();
    await expect(page).toHaveURL(/\/crm\/cskh-board/);
    await expect(page.getByRole('heading', { name: /Bảng CSKH/i })).toBeVisible({ timeout: 15_000 });
  });
});
