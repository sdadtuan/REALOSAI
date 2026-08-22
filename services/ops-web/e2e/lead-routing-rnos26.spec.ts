import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * RNOS-26 — Lead Routing Agent v1 smoke (score → route API).
 */
test.describe('RNOS-26 lead routing', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
  });

  test('route lead API returns recommendation payload', async ({ request }) => {
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

    const leadsRes = await request.get(
      `${process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000'}/api/crm/leads?limit=5&owner_id=0`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    test.skip(!leadsRes.ok(), 'Leads list failed');
    const leadsBody = await leadsRes.json();
    const leadId = leadsBody.leads?.[0]?.id as number | undefined;
    test.skip(!leadId, 'No unassigned lead for routing test');

    await request.post(
      `${process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000'}/api/v1/ai/score/lead`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { lead_id: leadId, force: true },
      },
    );

    const routeRes = await request.post(
      `${process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000'}/api/v1/ai/route/lead`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { lead_id: leadId },
      },
    );

    if (routeRes.status() === 400) {
      const err = await routeRes.json();
      test.skip(err.error === 'no_route_candidate' || err.error === 'lead_already_owned', 'No routing candidate');
    }

    expect(routeRes.ok()).toBeTruthy();
    const body = await routeRes.json();
    expect(body.data.recommended_staff_id).toBeGreaterThan(0);
    expect(typeof body.data.reason).toBe('string');
  });

  test('copilot shows route card for unassigned lead', async ({ page, request }) => {
    await loginAsStaff(page);
    const token = await page.evaluate(() => localStorage.getItem('ptt_staff_access_token'));
    test.skip(!token, 'No staff token after login');

    const leadsRes = await request.get(
      `${process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000'}/api/crm/leads?limit=10`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    test.skip(!leadsRes.ok(), 'Leads list failed');
    const leadsBody = await leadsRes.json();
    const lead = (leadsBody.leads as Array<{ id: number; owner_id: number | null }> | undefined)?.find(
      (row) => row.owner_id == null,
    );
    test.skip(!lead, 'No unassigned lead');
    const leadId = lead!.id;

    await page.goto(`/crm/leads/${leadId}`);
    await expect(page.getByLabel('AI Copilot')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('route-rep-card')).toBeVisible({ timeout: 25_000 });
  });
});
