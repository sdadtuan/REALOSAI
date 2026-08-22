import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

/**
 * RNOS-43A — KPI dashboard v2 (shell, trend, Excel export, alert drill).
 */
test.describe('RNOS-43A KPI dashboard v2', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/kpi uses dashboard shell with split chart + alerts', async ({ page }) => {
    await page.goto('/crm/kpi');
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.kpi-page__section--split')).toBeVisible();
    await expect(page.locator('.kpi-tile-grid').getByText(/Tỷ lệ chấp nhận AI/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('API — staff KPI export.xlsx', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const res = await request.get(`${API_URL}/api/crm/staff/kpi/export.xlsx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `export.xlsx: ${res.status()}`).toBeTruthy();
    expect(res.headers()['content-type']).toContain('spreadsheetml');
  });

  test('API — KPI metric trend endpoint', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const metrics = await request.get(`${API_URL}/api/crm/kpi/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(metrics.ok()).toBeTruthy();
    const body = (await metrics.json()) as { metrics?: Array<{ id?: number }> };
    const metricId = body.metrics?.[0]?.id;
    test.skip(!metricId, 'No KPI metrics defined');
    const trend = await request.get(
      `${API_URL}/api/crm/kpi/trend?metric_id=${metricId}&months=6`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(trend.ok(), `trend: ${trend.status()}`).toBeTruthy();
  });
});
