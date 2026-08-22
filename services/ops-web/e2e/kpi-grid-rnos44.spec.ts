import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

/**
 * RNOS-44 — editable KPI grid on /crm/kpi.
 */
test.describe('RNOS-44 KPI editable grid', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/kpi shows editable grid for selected period', async ({ page }) => {
    await page.goto('/crm/kpi');
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Năm').fill('2026');
    await page.getByLabel('Tháng').fill('5');

    await expect(page.getByRole('heading', { name: /Nhập actual KPI/i })).toBeVisible();
    await expect(page.locator('.kpi-editable-grid__table')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.kpi-editable-grid__actual-input').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Lưu thay đổi/i })).toBeVisible();
  });

  test('edit actual and save refreshes grid', async ({ page, request }) => {
    await page.goto('/crm/kpi');
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Năm').fill('2026');
    await page.getByLabel('Tháng').fill('5');

    const input = page.locator('.kpi-editable-grid__actual-input').first();
    await expect(input).toBeVisible({ timeout: 15_000 });

    const token = await staffToken(request);
    const list = await request.get(`${API_URL}/api/crm/staff/kpi?year=2026&month=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as { staff_kpi?: Array<{ id?: number; actual_value?: number | null }> };
    const first = body.staff_kpi?.[0];
    test.skip(!first?.id, 'No staff KPI rows for 2026/05');
    const kpiId = first!.id!;
    const priorActual = first!.actual_value;

    const nextValue = priorActual == null ? 42 : Number(priorActual) + 1;
    await input.fill(String(nextValue));
    await page.getByRole('button', { name: /Lưu thay đổi/i }).click();

    await expect
      .poll(async () => {
        const patchCheck = await request.get(`${API_URL}/api/crm/staff/kpi?year=2026&month=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const after = (await patchCheck.json()) as {
          staff_kpi?: Array<{ id?: number; actual_value?: number | null }>;
        };
        const saved = after.staff_kpi?.find((row) => row.id === kpiId);
        return Number(saved?.actual_value);
      })
      .toBe(nextValue);
  });

  test('API — PATCH staff KPI actual rejects negative', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const list = await request.get(`${API_URL}/api/crm/staff/kpi?year=2026&month=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(list.ok()).toBeTruthy();
    const body = (await list.json()) as { staff_kpi?: Array<{ id?: number }> };
    const kpiId = body.staff_kpi?.[0]?.id;
    test.skip(!kpiId, 'No staff KPI rows');

    const res = await request.patch(`${API_URL}/api/crm/staff/kpi/${kpiId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { actual_value: -1 },
    });
    expect(res.status()).toBe(400);
  });
});
