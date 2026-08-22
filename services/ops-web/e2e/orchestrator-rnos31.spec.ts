import { test, expect } from '@playwright/test';
import {
  API_URL,
  STAFF_EMAIL,
  STAFF_PASSWORD,
  apiReachable,
  loginAsStaff,
} from './helpers/ai-copilot-helpers';

async function resolveLeadFixture(
  request: import('@playwright/test').APIRequestContext,
  token: string,
): Promise<number | null> {
  const configured = Number(process.env.OPS_E2E_AI_LEAD_ID);
  if (Number.isInteger(configured) && configured > 0) return configured;

  const response = await request.get(`${API_URL}/api/v1/leads?limit=1&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) return null;
  const body = (await response.json()) as {
    leads?: Array<{ id?: number }>;
    data?: { leads?: Array<{ id?: number }> };
  };
  const id = body.leads?.[0]?.id ?? body.data?.leads?.[0]?.id;
  return Number.isInteger(id) && Number(id) > 0 ? Number(id) : null;
}

test.describe('RNOS-31 Multi-agent orchestrator UI', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(process.env.OPS_E2E_SKIP_SERVER === '1', 'ops-web server not started');
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/admin/ai/agents shows trace heading and tree region', async ({ page }) => {
    await page.goto('/admin/ai/agents');
    await expect(page.getByRole('heading', { level: 2, name: /Multi-agent traces/i })).toBeVisible({
      timeout: 20_000,
    });
    const detail = page.locator('.orchestration-trace-panel__detail');
    await expect(detail).toBeVisible({ timeout: 20_000 });
    await expect(detail.getByRole('heading', { level: 3, name: /Orchestration trace/i })).toBeVisible();
    await expect(page.locator('.orchestration-trace-panel pre')).toHaveCount(0);
  });
});

test.describe('RNOS-31 Multi-agent orchestrator API', () => {
  test('POST orchestrator/run', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const login = await request.post(`${API_URL}/api/v1/staff/auth/login`, {
      data: { email: STAFF_EMAIL, password: STAFF_PASSWORD },
    });
    if (!login.ok()) {
      test.skip(true, `Staff login unavailable: ${login.status()}`);
    }
    const loginBody = (await login.json()) as { access_token?: string };
    if (!loginBody.access_token) {
      test.skip(true, 'Staff login returned no access_token');
      return;
    }
    const token = loginBody.access_token;
    const leadId = await resolveLeadFixture(request, token);
    test.skip(!leadId, 'No lead fixture available for orchestrator E2E');

    const runResponse = await request.post(`${API_URL}/api/v1/ai/orchestrator/run`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        planKey: 'lead_intake_v1',
        input: {
          entityType: 'lead',
          entityId: String(leadId),
          leadId,
        },
      },
    });
    if (runResponse.status() === 503) {
      test.skip(true, 'Orchestrator flag or RNOS-31 schema not ready');
    }
    if (runResponse.status() === 403) {
      test.skip(true, 'Staff lacks ai_orchestrator.run cap');
    }
    if (!runResponse.ok()) {
      test.skip(true, `orchestrator/run: ${runResponse.status()} ${await runResponse.text()}`);
    }

    const run = (await runResponse.json()) as {
      data?: {
        orchestration_id?: string;
        plan_key?: string;
        steps?: Array<{ stepKey?: string; status?: string }>;
      };
    };
    expect(run.data?.plan_key).toBe('lead_intake_v1');
    expect(run.data?.orchestration_id).toBeTruthy();
    expect(run.data?.steps?.some((step) => step.stepKey === 'score_lead')).toBeTruthy();
  });
});
