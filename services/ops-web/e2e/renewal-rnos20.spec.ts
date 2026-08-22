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

test.describe('RNOS-20 Renewal agent', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/agency/clients/[id] Retain tab shows renewal panel', async ({ page, request }) => {
    const clientId = await resolveAgencyClientId(request);
    test.skip(!clientId, 'No agency client for renewal E2E');

    await page.goto(`/agency/clients/${clientId}?tab=retain`);
    await expect(page.getByTestId('renewal-agent-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 3, name: /Renewal Agent/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('API — POST renewal/scan + GET renewal list', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const clientId = await resolveAgencyClientId(request);
    test.skip(!clientId, 'No agency client');

    const scanRes = await request.post(`${API_URL}/api/v1/ai/renewal/scan`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { windows: [90, 60, 30] },
    });
    if (scanRes.status() === 503) {
      test.skip(true, 'renewal_opportunities DDL not ready');
    }
    expect(scanRes.ok(), `scan: ${scanRes.status()} ${await scanRes.text()}`).toBeTruthy();

    const listRes = await request.get(`${API_URL}/api/v1/ai/renewal?client_id=${clientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok(), `list: ${listRes.status()} ${await listRes.text()}`).toBeTruthy();
    const listed = (await listRes.json()) as { data?: { opportunities?: unknown[]; total?: number } };
    expect(Array.isArray(listed.data?.opportunities)).toBeTruthy();
    expect(listed.data?.total).toBeGreaterThanOrEqual(0);
  });
});
