import { test, expect } from '@playwright/test';
import { API_URL, apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

test.describe('RNOS-21 Manager coach digest', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/ai/coach shows coach digest panel', async ({ page }) => {
    await page.goto('/crm/ai/coach');
    await expect(page.getByTestId('coach-digest-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /Manager Coach digest/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('API — POST coach/generate + GET coach/current', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);

    const genRes = await request.post(`${API_URL}/api/v1/ai/coach/generate`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { force: true },
    });
    if (genRes.status() === 503) {
      test.skip(true, 'ai_insights DDL not ready');
    }
    expect(genRes.ok(), `generate: ${genRes.status()} ${await genRes.text()}`).toBeTruthy();

    const curRes = await request.get(`${API_URL}/api/v1/ai/coach/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(curRes.ok(), `current: ${curRes.status()} ${await curRes.text()}`).toBeTruthy();
    const body = (await curRes.json()) as { data?: { snapshot?: { cards?: unknown[] } } | null };
    if (body.data?.snapshot) {
      expect(Array.isArray(body.data.snapshot.cards)).toBeTruthy();
    }
  });
});
