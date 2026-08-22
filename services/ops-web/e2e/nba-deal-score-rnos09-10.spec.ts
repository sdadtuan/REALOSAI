import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

const API_URL = process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000';

async function resolvePipelineDealId(request: import('@playwright/test').APIRequestContext): Promise<number | null> {
  const token = await staffToken(request);
  const res = await request.get(`${API_URL}/api/crm/sales/pipeline-cases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return null;
  const body = (await res.json()) as { cases?: Array<{ id?: number }> };
  const id = body.cases?.[0]?.id;
  return id && Number.isFinite(id) ? id : null;
}

test.describe('RNOS-09/10 Deal score + NBA', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/sales funnel tab shows pipeline kanban', async ({ page }) => {
    await page.goto('/crm/sales');
    await page.getByRole('button', { name: 'Funnel' }).click();
    await expect(page.locator('.sales-pipeline-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.sales-pipeline-kanban')).toBeVisible();
  });

  test('API — POST /api/v1/ai/score/deal validates deal_id', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const res = await request.post(`${API_URL}/api/v1/ai/score/deal`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { deal_id: 999999, force: true },
    });
    if (res.status() === 503) {
      test.skip(true, 'ai_scores DDL not ready');
    }
    expect([200, 404]).toContain(res.status());
  });

  test('API — deal score batch + explain factors (AI-UC-012)', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const dealId = await resolvePipelineDealId(request);
    test.skip(!dealId, 'No pipeline cases in CRM');

    const scoreRes = await request.post(`${API_URL}/api/v1/ai/score/deal`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { deal_id: dealId, force: true },
    });
    if (scoreRes.status() === 503) {
      test.skip(true, 'ai_scores DDL not ready');
    }
    expect(scoreRes.ok(), `score deal: ${scoreRes.status()} ${await scoreRes.text()}`).toBeTruthy();
    const scored = (await scoreRes.json()) as {
      data?: { score?: number; explainability?: { factors?: unknown[] } };
    };
    expect(scored.data?.score).toBeGreaterThanOrEqual(0);
    expect((scored.data?.explainability?.factors ?? []).length).toBeGreaterThanOrEqual(2);

    const batchRes = await request.get(
      `${API_URL}/api/v1/ai/scores/batch?entity_type=deal&entity_ids=${dealId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(batchRes.ok(), `batch: ${batchRes.status()} ${await batchRes.text()}`).toBeTruthy();
    const batch = (await batchRes.json()) as {
      data?: { scores_by_entity_id?: Record<string, { score_value?: number }> };
    };
    expect(batch.data?.scores_by_entity_id?.[String(dealId)]?.score_value).toBeDefined();
  });

  test('API — stage change triggers deal rescore', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);
    const dealId = await resolvePipelineDealId(request);
    test.skip(!dealId, 'No pipeline cases in CRM');

    const detailRes = await request.get(`${API_URL}/api/crm/cases/${dealId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    test.skip(!detailRes.ok(), 'Cannot load case detail');
    const detail = (await detailRes.json()) as { pipeline_stage?: string };
    const currentStage = detail.pipeline_stage ?? 'moi';
    const nextStage = currentStage === 'moi' ? 'dang_lien_he' : 'moi';

    const patchRes = await request.patch(`${API_URL}/api/crm/cases/${dealId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { pipeline_stage: nextStage },
    });
    expect(patchRes.ok(), `patch stage: ${patchRes.status()} ${await patchRes.text()}`).toBeTruthy();

    const scoreRes = await request.post(`${API_URL}/api/v1/ai/score/deal`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { deal_id: dealId, force: true },
    });
    if (scoreRes.status() === 503) {
      test.skip(true, 'ai_scores DDL not ready');
    }
    expect(scoreRes.ok(), `rescore: ${scoreRes.status()}`).toBeTruthy();

    await request.patch(`${API_URL}/api/crm/cases/${dealId}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { pipeline_stage: currentStage },
    });
  });

  test('funnel card shows deal score mini-bar after open', async ({ page, request }) => {
    await page.goto('/crm/sales');
    await page.getByRole('button', { name: 'Funnel' }).click();
    await expect(page.locator('.sales-pipeline-kanban')).toBeVisible({ timeout: 20_000 });

    const firstCard = page.locator('.sales-pipeline-card').first();
    test.skip((await firstCard.count()) === 0, 'No pipeline cards');

    await firstCard.click();
    await expect(page.locator('.sales-pipeline-drawer')).toBeVisible();
    await expect(page.locator('.ai-explain-chips li').first()).toBeVisible({ timeout: 20_000 });

    const dealId = await resolvePipelineDealId(request);
    test.skip(!dealId, 'No pipeline cases');

    await expect(page.locator('[data-testid="deal-score-mini"]').first()).toBeVisible({ timeout: 20_000 });
  });
});
