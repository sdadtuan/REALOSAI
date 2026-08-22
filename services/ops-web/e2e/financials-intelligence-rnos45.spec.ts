import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

/**
 * RNOS-45 — Financial intelligence on /crm/financials.
 */
test.describe('RNOS-45 Financial intelligence', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/financials shows intelligence panel and action section', async ({ page }) => {
    await page.goto('/crm/financials');
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Financial intelligence/i })).toBeVisible();
    await expect(page.locator('.financial-intelligence-panel .kpi-tile__label').filter({ hasText: /Burn rate tháng/i })).toBeVisible();
    await expect(page.locator('.financial-intelligence-panel .kpi-tile__label').filter({ hasText: /^Margin at risk$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Cần xử lý/i })).toBeVisible();
    await expect(page.locator('.financial-intelligence-trend')).toHaveCount(2);
  });

  test('lifecycle table shows payment gate column', async ({ page }) => {
    await page.goto('/crm/financials');
    await expect(page.locator('.financials-lifecycle-table')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.financials-lifecycle-table th').filter({ hasText: /Gate/i })).toBeVisible();
  });

  test('API — finance intelligence endpoint', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const res = await request.get(`${API_URL}/api/crm/finance/intelligence?months=6`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `intelligence: ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as {
      burn_rate?: Record<string, unknown>;
      margin_at_risk?: Record<string, unknown>;
      trends?: { labels?: string[] };
      actions?: unknown[];
    };
    expect(body.burn_rate).toBeTruthy();
    expect(body.margin_at_risk).toBeTruthy();
    expect(Array.isArray(body.trends?.labels)).toBeTruthy();
    expect(Array.isArray(body.actions)).toBeTruthy();
  });
});
