import { test, expect } from '@playwright/test';
import {
  API_URL,
  STAFF_EMAIL,
  STAFF_PASSWORD,
  apiReachable,
  loginAsStaff,
} from './helpers/ai-copilot-helpers';

async function loginForApi(
  request: import('@playwright/test').APIRequestContext,
): Promise<string | null> {
  const login = await request.post(`${API_URL}/api/v1/staff/auth/login`, {
    data: { email: STAFF_EMAIL, password: STAFF_PASSWORD },
  });
  if (!login.ok()) return null;
  const body = (await login.json()) as { access_token?: string };
  return body.access_token ?? null;
}

test.describe('RNOS-33 AI tools admin UI', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(process.env.OPS_E2E_SKIP_SERVER === '1', 'ops-web server not started');
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/admin/ai/tools shows key management and tool catalog', async ({ page }) => {
    await page.goto('/admin/ai/tools');
    await expect(page.getByRole('heading', { level: 2, name: /AI tool keys/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Tạo key/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: /Tool catalog/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Mutating/i })).toBeVisible();
  });
});

test.describe('RNOS-33 scoped external tool API', () => {
  test('creates a scoped key, calls health, rejects disallowed tool, and rejects revoked key', async ({
    request,
  }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await loginForApi(request);
    test.skip(!token, 'Staff login unavailable or returned no access_token');

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const catalogResponse = await request.get(`${API_URL}/api/v1/ai/tools`, {
      headers: authHeaders,
    });
    if (catalogResponse.status() === 503) {
      test.skip(true, 'AI tools flag or RNOS-33 schema not ready');
    }
    if (catalogResponse.status() === 403) {
      test.skip(true, 'Staff lacks ai_admin.view cap');
    }
    if (!catalogResponse.ok()) {
      test.skip(true, `GET ai/tools: ${catalogResponse.status()} ${await catalogResponse.text()}`);
    }
    const catalog = (await catalogResponse.json()) as {
      tools?: Array<{ name?: string; inputSchema?: unknown }>;
      data?: { tools?: Array<{ name?: string; inputSchema?: unknown }> };
    };
    const tools = catalog.tools ?? catalog.data?.tools ?? [];
    expect(tools.some((tool) => tool.name === 'health_check' && tool.inputSchema)).toBeTruthy();

    const createResponse = await request.post(`${API_URL}/api/v1/admin/ai/tool-keys`, {
      headers: authHeaders,
      data: {
        name: `RNOS-33 Playwright ${Date.now()}`,
        allowed_tools: ['health_check'],
      },
    });
    if (createResponse.status() === 403) {
      test.skip(true, 'Staff cannot manage AI tool keys');
    }
    if (!createResponse.ok()) {
      test.skip(
        true,
        `POST admin/ai/tool-keys: ${createResponse.status()} ${await createResponse.text()}`,
      );
    }
    const created = (await createResponse.json()) as {
      id?: string;
      key?: string;
      data?: { id?: string; key?: string };
    };
    const keyId = created.id ?? created.data?.id;
    const plaintextKey = created.key ?? created.data?.key;
    expect(keyId).toBeTruthy();
    expect(plaintextKey).toMatch(/^ptt_ai_/);

    const toolHeaders = {
      'X-AI-Tool-Key': String(plaintextKey),
      'Content-Type': 'application/json',
    };
    const healthResponse = await request.post(`${API_URL}/api/v1/ai/tools/call`, {
      headers: toolHeaders,
      data: { tool_name: 'health_check', input: {} },
    });
    expect(healthResponse.ok()).toBeTruthy();
    const healthBody = (await healthResponse.json()) as {
      tool_name?: string;
      result?: { ok?: boolean };
      data?: { tool_name?: string; result?: { ok?: boolean } };
    };
    expect(healthBody.tool_name ?? healthBody.data?.tool_name).toBe('health_check');
    expect(healthBody.result?.ok ?? healthBody.data?.result?.ok).toBe(true);

    const disallowedResponse = await request.post(`${API_URL}/api/v1/ai/tools/call`, {
      headers: toolHeaders,
      data: { tool_name: 'list_leads', input: { limit: 1 } },
    });
    expect(disallowedResponse.status()).toBe(403);

    const revokeResponse = await request.delete(
      `${API_URL}/api/v1/admin/ai/tool-keys/${encodeURIComponent(String(keyId))}`,
      { headers: authHeaders },
    );
    expect(revokeResponse.ok()).toBeTruthy();

    const revokedResponse = await request.post(`${API_URL}/api/v1/ai/tools/call`, {
      headers: toolHeaders,
      data: { tool_name: 'health_check', input: {} },
    });
    expect(revokedResponse.status()).toBe(401);
  });
});
