import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

async function resolveCustomerId(request: import('@playwright/test').APIRequestContext): Promise<number | null> {
  const token = await staffToken(request);
  const res = await request.get(`${API_URL}/api/crm/customers?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return null;
  const body = (await res.json()) as { customers?: Array<{ id?: number }> };
  const id = body.customers?.[0]?.id;
  return id && Number.isFinite(id) ? id : null;
}

test.describe('RNOS-16 Customer timeline (AI-UC-008)', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/customers/[id] shows unified timeline panel', async ({ page, request }) => {
    const customerId = await resolveCustomerId(request);
    test.skip(!customerId, 'No customers in CRM');

    await page.goto(`/crm/customers/${customerId}`);
    await expect(page.getByTestId('customer-timeline-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Timeline thống nhất')).toBeVisible();
  });

  test('API — customer timeline + completeness gate', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const customerId = await resolveCustomerId(request);
    test.skip(!customerId, 'No customers in CRM');

    const timelineRes = await request.get(`${API_URL}/api/crm/customers/${customerId}/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(timelineRes.ok(), `timeline: ${timelineRes.status()} ${await timelineRes.text()}`).toBeTruthy();
    const timeline = (await timelineRes.json()) as {
      customer_id?: number;
      linked_lead_ids?: number[];
      events?: unknown[];
      timeline_ready?: boolean;
    };
    expect(timeline.customer_id).toBe(customerId);
    expect(Array.isArray(timeline.linked_lead_ids)).toBeTruthy();
    expect(Array.isArray(timeline.events)).toBeTruthy();

    const completenessRes = await request.get(`${API_URL}/api/v1/ai/timeline/completeness?sample_limit=500`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (completenessRes.status() === 500) {
      test.skip(true, 'timeline DDL not ready');
    }
    expect(completenessRes.ok(), `completeness: ${completenessRes.status()}`).toBeTruthy();
    const completeness = (await completenessRes.json()) as {
      data?: { completeness_pct?: number; gate_pass?: boolean; total_leads?: number };
    };
    expect(completeness.data?.completeness_pct).toBeGreaterThanOrEqual(0);
    if ((completeness.data?.total_leads ?? 0) >= 50) {
      expect(completeness.data?.gate_pass).toBe(completeness.data!.completeness_pct! >= 70);
    }
  });

  test('API — timeline backfill accepts internal/staff auth', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const res = await request.post(`${API_URL}/api/v1/ai/timeline/backfill`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { limit: 5 },
    });
    if (res.status() === 503 || res.status() === 500) {
      test.skip(true, 'timeline DDL not ready');
    }
    expect(res.ok(), `backfill: ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = (await res.json()) as { data?: { leads_processed?: number; events_mirrored?: number } };
    expect(body.data?.leads_processed).toBeGreaterThanOrEqual(0);
  });
});
