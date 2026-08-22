import { test, expect } from '@playwright/test';
import { API_URL, apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

async function resolvePipelineDealId(request: import('@playwright/test').APIRequestContext): Promise<number | null> {
  const token = await staffToken(request);
  const res = await request.get(`${API_URL}/api/crm/sales/pipeline-cases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return null;
  const body = (await res.json()) as { cases?: Array<{ id?: number }> };
  const id = body.cases?.[0]?.id;
  return id && Number.isFinite(id) ? id : null;
}

test.describe('RNOS-23 Pipeline risk scan', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/ai/insights shows At-risk deals panel', async ({ page }) => {
    await page.goto('/crm/ai/insights');
    await expect(page.getByTestId('pipeline-risk-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 3, name: /At-risk deals/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('API — POST pipeline-risk/scan + GET at-risk', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);

    const scanRes = await request.post(`${API_URL}/api/v1/ai/pipeline-risk/scan`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { limit: 50 },
    });
    if (scanRes.status() === 503) {
      test.skip(true, 'ai_recommendations DDL not ready');
    }
    expect(scanRes.ok(), `scan: ${scanRes.status()} ${await scanRes.text()}`).toBeTruthy();
    const scanned = (await scanRes.json()) as { data?: { scanned?: number; agent_run_id?: string } };
    expect(scanned.data?.scanned).toBeGreaterThanOrEqual(0);
    expect(scanned.data?.agent_run_id).toBeTruthy();

    const listRes = await request.get(`${API_URL}/api/v1/ai/pipeline-risk/at-risk?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok(), `at-risk: ${listRes.status()} ${await listRes.text()}`).toBeTruthy();
    const listed = (await listRes.json()) as { data?: { deals?: unknown[]; total?: number } };
    expect(Array.isArray(listed.data?.deals)).toBeTruthy();
    expect(listed.data?.total).toBeGreaterThanOrEqual(0);
  });

  test('drill from insights to sales funnel drawer', async ({ page, request }) => {
    const token = await staffToken(request);
    const scanRes = await request.post(`${API_URL}/api/v1/ai/pipeline-risk/scan`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { limit: 50 },
    });
    if (scanRes.status() === 503) {
      test.skip(true, 'ai_recommendations DDL not ready');
    }
    expect(scanRes.ok()).toBeTruthy();

    const listRes = await request.get(`${API_URL}/api/v1/ai/pipeline-risk/at-risk?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const listed = (await listRes.json()) as { data?: { deals?: Array<{ deal_id?: number }> } };
    const dealId = listed.data?.deals?.[0]?.deal_id ?? (await resolvePipelineDealId(request));
    test.skip(!dealId, 'No deals for drill-through');

    await page.goto('/crm/ai/insights');
    await expect(page.getByTestId('pipeline-risk-panel')).toBeVisible({ timeout: 20_000 });

    const dealLink = page.locator('.pipeline-risk-panel__deal-link').first();
    if ((await dealLink.count()) > 0) {
      await dealLink.click();
    } else {
      await page.goto(`/crm/sales?deal_id=${dealId}`);
      await page.getByRole('button', { name: 'Funnel' }).click();
    }

    await expect(page.locator('.sales-pipeline-drawer')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.ai-explain-chips li').first()).toBeVisible({ timeout: 20_000 });
  });
});
