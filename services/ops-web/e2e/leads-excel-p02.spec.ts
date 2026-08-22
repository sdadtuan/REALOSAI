import { test, expect } from '@playwright/test';
import { API_URL, apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

/**
 * P0-2 — Lead import/export Excel smoke.
 */
test.describe('P0-2 Lead Excel IO', () => {
  test('template and export endpoints return xlsx', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');

    const token = await staffToken(request);

    const template = await request.get(`${API_URL}/api/v1/leads/import/template.xlsx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(template.ok()).toBeTruthy();
    expect(template.headers()['content-type']).toContain('spreadsheetml');
    expect((await template.body()).length).toBeGreaterThan(100);

    const exported = await request.get(`${API_URL}/api/v1/leads/export.xlsx`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(exported.ok()).toBeTruthy();
    expect(exported.headers()['content-type']).toContain('spreadsheetml');
    expect((await exported.body()).length).toBeGreaterThan(100);
  });

  test('leads page shows import/export toolbar', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
    await page.goto('/crm/leads');
    await expect(page.getByRole('button', { name: /mẫu excel/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /export excel \(filter\)/i })).toBeVisible();
    await expect(page.locator('.crm-leads-io')).toBeVisible();
  });
});
