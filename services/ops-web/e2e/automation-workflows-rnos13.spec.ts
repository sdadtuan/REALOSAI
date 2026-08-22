import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

/**
 * RNOS-13…15 / UI-R2-04 — Workflow automation builder + simulate.
 */
test.describe('R2 Automation workflows', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/automation shows workflow builder panel', async ({ page }) => {
    await page.goto('/crm/automation');
    await expect(page.getByRole('heading', { level: 2, name: /workflow automation/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.automation-workflows-panel')).toBeVisible();
    await expect(page.locator('.automation-workflows-table')).toBeVisible();
  });

  test('API — GET /api/v1/automation-workflows returns envelope', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const res = await request.get(`${API_URL}/api/v1/automation-workflows?limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status() === 503) {
      test.skip(true, 'automation_workflows DDL not ready in this environment');
    }
    expect(res.ok(), `automation-workflows: ${res.status()}`).toBeTruthy();
    const body = (await res.json()) as { data?: { rows?: unknown[]; total?: number } };
    expect(Array.isArray(body.data?.rows)).toBeTruthy();
    expect(typeof body.data?.total).toBe('number');
  });
});
