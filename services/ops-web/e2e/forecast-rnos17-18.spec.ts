import { test, expect } from '@playwright/test';
import { API_URL, apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

test.describe('RNOS-17/18 Forecast dashboard', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/forecast shows KPI cards and commit panel', async ({ page }) => {
    await page.goto('/crm/forecast');
    await expect(page.getByTestId('forecast-dashboard-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Pipeline weighted')).toBeVisible();
    await expect(page.getByText('AI gợi ý')).toBeVisible();
    await expect(page.getByTestId('forecast-commit-panel')).toBeVisible();
    await expect(page.getByTestId('forecast-explain-panel')).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('API — POST forecast snapshot + GET current dashboard', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);

    const scanRes = await request.post(`${API_URL}/api/v1/ai/forecast`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { force: true },
    });
    if (scanRes.status() === 503) {
      test.skip(true, 'revenue_forecast_snapshots DDL not ready');
    }
    expect(scanRes.ok(), `forecast: ${scanRes.status()} ${await scanRes.text()}`).toBeTruthy();
    const scanned = (await scanRes.json()) as { data?: { snapshot_id?: string; agent_run_id?: string } };
    expect(scanned.data?.snapshot_id).toBeTruthy();

    const dashRes = await request.get(`${API_URL}/api/v1/ai/forecast/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dashRes.ok(), `dashboard: ${dashRes.status()} ${await dashRes.text()}`).toBeTruthy();
    const dash = (await dashRes.json()) as {
      data?: { pipeline_amount?: number; forecast_amount?: number; snapshot?: { id?: string } | null };
    };
    expect(dash.data?.pipeline_amount).toBeGreaterThanOrEqual(0);
    expect(dash.data?.snapshot?.id).toBeTruthy();
  });
});
