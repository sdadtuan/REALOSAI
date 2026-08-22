import { test, expect } from '@playwright/test';
import { API_URL, apiReachable, loginAsStaff, resolveLeadId, staffToken } from './helpers/ai-copilot-helpers';

test.describe('P1 CRM parity — lead attribution chips', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('API — GET /api/crm/leads/:id/attribution', async ({ request }) => {
    const token = await staffToken(request);
    const leadId = await resolveLeadId(request);

    const res = await request.get(`${API_URL}/api/crm/leads/${leadId}/attribution`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `attribution: ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = (await res.json()) as {
      data?: { lead_id?: number; hub_href?: string; period_days?: number };
    };
    expect(body.data?.lead_id).toBe(leadId);
    expect(body.data?.hub_href).toBeTruthy();
    expect(body.data?.period_days).toBeGreaterThan(0);
  });

  test('lead detail renders attribution chip region', async ({ page, request }) => {
    const leadId = await resolveLeadId(request);
    await page.goto(`/crm/leads/${leadId}`);
    await expect(page.getByTestId('lead-attribution-chips')).toBeVisible({ timeout: 20_000 });
  });
});
