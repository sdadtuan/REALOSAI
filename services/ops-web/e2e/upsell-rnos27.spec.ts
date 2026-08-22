import { test, expect } from '@playwright/test';
import { API_URL, apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

async function resolveAgencyClientId(request: import('@playwright/test').APIRequestContext): Promise<string | null> {
  const token = await staffToken(request);
  const res = await request.get(`${API_URL}/api/v1/clients?limit=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return null;
  const body = (await res.json()) as { clients?: Array<{ id?: string }> };
  const id = body.clients?.[0]?.id;
  return id && String(id).length > 0 ? id : null;
}

test.describe('RNOS-27 Upsell agent', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/agency/clients/[id] Retain tab shows upsell panel', async ({ page, request }) => {
    const clientId = await resolveAgencyClientId(request);
    test.skip(!clientId, 'No agency client for upsell E2E');

    await page.goto(`/agency/clients/${clientId}?tab=retain`);
    await expect(page.getByTestId('upsell-agent-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 3, name: /Upsell Agent/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('API — POST upsell/suggest + GET upsell list', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const clientId = await resolveAgencyClientId(request);
    test.skip(!clientId, 'No agency client');

    const suggestRes = await request.post(`${API_URL}/api/v1/ai/upsell/suggest`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { client_id: clientId, limit: 2 },
    });
    if (suggestRes.status() === 503) {
      test.skip(true, 'ai_recommendations DDL not ready or upsell disabled');
    }
    expect(suggestRes.ok(), `suggest: ${suggestRes.status()} ${await suggestRes.text()}`).toBeTruthy();

    const listRes = await request.get(`${API_URL}/api/v1/ai/upsell?client_id=${clientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok(), `list: ${listRes.status()} ${await listRes.text()}`).toBeTruthy();
    const listed = (await listRes.json()) as { data?: { suggestions?: unknown[]; total?: number } };
    expect(Array.isArray(listed.data?.suggestions)).toBeTruthy();
    expect(listed.data?.total).toBeGreaterThanOrEqual(0);
  });
});
