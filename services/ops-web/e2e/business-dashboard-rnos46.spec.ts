import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

/**
 * RNOS-46 — Business dashboard executive (12-week sparkline + attribution drill).
 */
test.describe('RNOS-46 Business dashboard executive', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/business-dashboard shows executive panel and drill table', async ({ page }) => {
    await page.goto('/crm/business-dashboard');
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.business-executive-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Executive trends · 12 tuần/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Attribution drill/i })).toBeVisible();
    await expect(page.locator('.business-executive-panel .kpi-trend-panel')).toHaveCount(3);
    await expect(page.locator('.business-executive-panel')).toContainText(/\d{4}-\d{2}-\d{2}/);
    await expect(
      page.locator('.business-drill-table, .business-executive-panel__drill .muted').last(),
    ).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('API — business dashboard includes executive block', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const res = await request.get(`${API_URL}/api/crm/finance/business-dashboard?months=6`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `business-dashboard: ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as {
      executive?: {
        weekly_trends?: { labels?: string[]; weeks?: number };
        attribution_drill?: { rows?: unknown[] };
      };
    };
    expect(body.executive?.weekly_trends?.weeks).toBe(12);
    expect(Array.isArray(body.executive?.weekly_trends?.labels)).toBeTruthy();
    expect(Array.isArray(body.executive?.attribution_drill?.rows)).toBeTruthy();
  });
});
