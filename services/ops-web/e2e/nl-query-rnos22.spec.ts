import { test, expect } from '@playwright/test';
import { API_URL, apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

test.describe('RNOS-22 NL query curated', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/ai/query shows curated panel', async ({ page }) => {
    await page.goto('/crm/ai/query');
    await expect(page.getByTestId('nl-query-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /NL Analytics curated/i })).toBeVisible();
    await expect(page.getByTestId('nl-query-presets')).toBeVisible();
  });

  test('API — GET catalog + POST query + out-of-scope 400', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);

    const catRes = await request.get(`${API_URL}/api/v1/ai/query/catalog`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(catRes.ok(), `catalog: ${catRes.status()} ${await catRes.text()}`).toBeTruthy();
    const catalog = (await catRes.json()) as { data?: { intents?: unknown[]; total?: number } };
    expect((catalog.data?.intents?.length ?? 0)).toBeGreaterThan(20);

    const runRes = await request.post(`${API_URL}/api/v1/ai/query`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { intent_id: 'leads_new_7d' },
    });
    expect(runRes.ok(), `query: ${runRes.status()} ${await runRes.text()}`).toBeTruthy();
    const body = (await runRes.json()) as { data?: { read_only?: boolean; narrative?: string } };
    expect(body.data?.read_only).toBe(true);
    expect(body.data?.narrative).toBeTruthy();

    const badRes = await request.post(`${API_URL}/api/v1/ai/query`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { question: 'drop table crm_leads' },
    });
    expect(badRes.status()).toBe(400);
    const badBody = (await badRes.json()) as { error?: string; message?: string };
    expect(badBody.error).toBe('query_out_of_scope');
  });
});
