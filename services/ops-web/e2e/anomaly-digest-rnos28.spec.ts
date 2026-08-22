import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * RNOS-28 — anomaly narrative in coach digest + hub API smoke.
 */
test.describe('RNOS-28 anomaly digest', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
  });

  test('coach digest includes channel anomaly card', async ({ page, request }) => {
    await loginAsStaff(page);
    const token = await page.evaluate(() => localStorage.getItem('ptt_staff_access_token'));
    test.skip(!token, 'No staff token after login');

    await request.post(`${process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000'}/api/v1/ai/coach/generate`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { force: true },
    });

    await page.goto('/crm/ai/coach');
    await expect(page.getByTestId('coach-digest-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('coach-card-channel_anomaly')).toBeVisible({ timeout: 20_000 });
  });

  test('anomaly digest API returns client-safe payload', async ({ request }) => {
    const loginRes = await request.post(
      `${process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000'}/api/v1/staff/auth/login`,
      {
        data: {
          email: process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local',
          password: process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo12345',
        },
      },
    );
    test.skip(!loginRes.ok(), 'Staff login failed');
    const loginBody = await loginRes.json();
    const token = loginBody.access_token as string;

    const res = await request.get(
      `${process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000'}/api/v1/ai/anomaly/digest?channel=meta&days=7`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data).toBeTruthy();
    expect(typeof body.data.enabled).toBe('boolean');
  });
});
