import { test, expect } from '@playwright/test';
import { apiReachable, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';
const OUTSIDER_TOKEN = process.env.B2B_E2E_OUTSIDER_TOKEN ?? '';
const OWNER_TOKEN = process.env.B2B_E2E_OWNER_TOKEN ?? '';
const DENIED_LEAD_ID = Number(process.env.B2B_E2E_DENIED_LEAD_ID ?? '0');
const ALLOWED_LEAD_ID = Number(process.env.B2B_E2E_ALLOWED_LEAD_ID ?? '0');

test.describe('B2B visibility', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
  });

  test('outsider lead detail is 404', async ({ request }) => {
    test.skip(!OUTSIDER_TOKEN || !DENIED_LEAD_ID, 'Set B2B_E2E_OUTSIDER_TOKEN + B2B_E2E_DENIED_LEAD_ID');
    const res = await request.get(`${API_URL}/api/v1/leads/${DENIED_LEAD_ID}`, {
      headers: { Authorization: `Bearer ${OUTSIDER_TOKEN}` },
    });
    expect(res.status()).toBe(404);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain('090');
  });

  test('owner lead detail is 200', async ({ request }) => {
    test.skip(!OWNER_TOKEN || !ALLOWED_LEAD_ID, 'Set B2B_E2E_OWNER_TOKEN + B2B_E2E_ALLOWED_LEAD_ID');
    const res = await request.get(`${API_URL}/api/v1/leads/${ALLOWED_LEAD_ID}`, {
      headers: { Authorization: `Bearer ${OWNER_TOKEN}` },
    });
    expect(res.status()).toBe(200);
  });

  test('ops summary requires auth', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/b2b-ops-summary`);
    expect(res.status()).toBeGreaterThanOrEqual(401);
  });

  test('ops summary returns counts for staff', async ({ request }) => {
    const token = await staffToken(request);
    const res = await request.get(`${API_URL}/api/v1/b2b-ops-summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status() === 403) {
      test.skip(true, 'Staff lacks crm_b2b_projects.view');
    }
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      unmatched_24h: number;
      hop_ge_2: number;
      sla_breach: number;
      cpaas_fail_24h: number;
    };
    expect(typeof body.unmatched_24h).toBe('number');
    expect(typeof body.hop_ge_2).toBe('number');
  });
});
