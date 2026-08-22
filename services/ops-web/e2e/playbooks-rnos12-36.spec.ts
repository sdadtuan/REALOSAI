import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

test.describe('RNOS-12/36 Playbook library + RAG', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/playbooks shows playbook library panel', async ({ page }) => {
    await page.goto('/crm/playbooks');
    await expect(page.getByRole('heading', { level: 2, name: /playbook library/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.playbooks-library-panel')).toBeVisible();
  });

  test('API — POST /api/v1/ai/playbooks/rag/query validates query', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const bad = await request.post(`${API_URL}/api/v1/ai/playbooks/rag/query`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { query: 'a' },
    });
    expect(bad.status()).toBe(400);

    const ok = await request.post(`${API_URL}/api/v1/ai/playbooks/rag/query`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { query: 'deal stalled gọi lại', limit: 3 },
    });
    if (ok.status() === 503) {
      test.skip(true, 'ai_playbooks DDL not ready');
    }
    expect(ok.ok(), `playbook rag: ${ok.status()}`).toBeTruthy();
    const body = (await ok.json()) as { data?: { citations?: unknown[]; answer?: string } };
    expect(Array.isArray(body.data?.citations)).toBeTruthy();
    expect(typeof body.data?.answer).toBe('string');
  });
});
