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

test.describe('RNOS-19 Churn health', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/health shows CS health dashboard', async ({ page }) => {
    await page.goto('/crm/health');
    await expect(page.getByTestId('cs-health-dashboard')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /CS Health score/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('/agency/clients/[id] Health tab shows client panel', async ({ page, request }) => {
    const clientId = await resolveAgencyClientId(request);
    test.skip(!clientId, 'No agency client for health E2E');

    await page.goto(`/agency/clients/${clientId}?tab=health`);
    await expect(page.getByTestId('client-health-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 3, name: /CS Health score/i })).toBeVisible();
  });

  test('API — POST score/churn + GET health dashboard', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);

    const scanRes = await request.post(`${API_URL}/api/v1/ai/score/churn`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { force: true, limit: 20 },
    });
    if (scanRes.status() === 503) {
      test.skip(true, 'customer_health_scores DDL not ready');
    }
    expect(scanRes.ok(), `scan: ${scanRes.status()} ${await scanRes.text()}`).toBeTruthy();

    const dashRes = await request.get(`${API_URL}/api/v1/ai/health?sort=churn_risk&order=desc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(dashRes.ok(), `dashboard: ${dashRes.status()} ${await dashRes.text()}`).toBeTruthy();
    const listed = (await dashRes.json()) as { data?: { clients?: unknown[]; total?: number } };
    expect(Array.isArray(listed.data?.clients)).toBeTruthy();
    expect(listed.data?.total).toBeGreaterThanOrEqual(0);
  });
});
