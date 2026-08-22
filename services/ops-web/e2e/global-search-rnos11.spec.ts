import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

test.describe('RNOS-11 OpenSearch global search', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('topbar global search bar is visible', async ({ page }) => {
    await page.goto('/crm/leads');
    await expect(page.locator('.global-search-bar')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.global-search-input')).toBeVisible();
  });

  test('typing query shows dropdown or empty state', async ({ page }) => {
    await page.goto('/crm/leads');
    const input = page.locator('.global-search-input');
    await input.fill('test');
    await expect(page.locator('.global-search-dropdown')).toBeVisible({ timeout: 10_000 });
  });

  test('API — GET /api/v1/search validates query length', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const bad = await request.get(`${API_URL}/api/v1/search?q=a`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(bad.status()).toBe(400);

    const ok = await request.get(`${API_URL}/api/v1/search?q=lead&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (ok.status() === 503) {
      test.skip(true, 'OpenSearch not configured — set OPENSEARCH_URL');
    }
    expect(ok.ok(), `search: ${ok.status()}`).toBeTruthy();
    const body = (await ok.json()) as { data?: { hits?: unknown[]; engine?: string } };
    expect(Array.isArray(body.data?.hits)).toBeTruthy();
    expect(body.data?.engine).toBe('opensearch');
  });
});
