import { test, expect, type APIRequestContext } from '@playwright/test';
import { API_URL, loginAsStaff } from './helpers/ai-copilot-helpers';

async function nestApiReachable(request: APIRequestContext): Promise<boolean> {
  try {
    const health = await request.get(`${API_URL}/health`, { timeout: 8_000 });
    return health.ok();
  } catch {
    return false;
  }
}

/**
 * RNOS-41 — PWA + mobile lead list smoke.
 */
test.describe('RNOS-41 PWA', () => {
  test('manifest and service worker assets are served', async ({ request }) => {
    const manifest = await request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBeTruthy();
    const body = (await manifest.json()) as { name?: string; start_url?: string };
    expect(body.name).toMatch(/PTT (CRM|Revenue OS)/);
    expect(body.start_url).toBe('/crm/leads');

    const sw = await request.get('/sw.js');
    expect(sw.ok()).toBeTruthy();
    expect(await sw.text()).toContain('ptt-ops-pwa-v3');

    const icon = await request.get('/icons/icon.svg');
    expect(icon.ok()).toBeTruthy();

    const png192 = await request.get('/icons/icon-192.png');
    expect(png192.ok()).toBeTruthy();
    expect(png192.headers()['content-type']).toContain('image/png');
  });

  test('mobile lead list shows cards instead of table', async ({ page, request }) => {
    test.skip(!(await nestApiReachable(request)), 'Nest API not reachable — start ptt-crm-api for auth');

    await loginAsStaff(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/crm/leads');

    await expect(page.getByText(/leads · trang/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.win-leads-mobile-list')).toBeVisible();
    await expect(page.locator('.crm-leads-table-wrap')).toBeHidden();
  });
});
