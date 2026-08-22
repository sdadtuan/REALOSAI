import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

/**
 * UI-R1-09 — Admin AI agent runs audit table.
 */
test.describe('UI-R1-09 Admin AI runs', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/admin/ai/runs shows filter toolbar and audit table', async ({ page }) => {
    await page.goto('/admin/ai/runs');
    await expect(page.getByRole('heading', { level: 2, name: /ai agent runs/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.admin-ai-runs-panel')).toBeVisible();
    await expect(page.locator('.admin-ai-runs-table')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Lọc$/i })).toBeVisible();
    await expect(page.locator('.admin-ai-runs-page pre')).toHaveCount(0);
  });

  test('API — GET /api/v1/ai/runs returns paginated envelope', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const res = await request.get(`${API_URL}/api/v1/ai/runs?limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status() === 503) {
      test.skip(true, 'AI audit schema not ready in this environment');
    }
    expect(res.ok(), `ai/runs: ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as {
      data?: { rows?: unknown[]; total?: number; limit?: number; offset?: number };
    };
    expect(Array.isArray(body.data?.rows)).toBeTruthy();
    expect(typeof body.data?.total).toBe('number');
  });
});
