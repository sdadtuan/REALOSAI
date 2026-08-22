import { test, expect } from '@playwright/test';
import {
  API_URL,
  SUMMARIZE_PASTE_TEXT,
  apiReachable,
  assertNoOutboundSendButtons,
  copilotPanel,
  fetchAgentRunCount,
  ensureLeadScored,
  loginAsStaff,
  resolveLeadId,
  staffToken,
  waitForScoreCard,
} from './helpers/ai-copilot-helpers';

/**
 * RNOS-39 — AI Copilot E2E (Pilot 8 bước UAT + API smoke).
 *
 * Env: see services/ops-web/e2e/README.md
 *
 * Local:
 *   bash scripts/playwright_ops_ai_copilot_e2e.sh
 *
 * CI:
 *   .github/workflows/rnos39-ai-copilot-e2e.yml
 */
test.describe('RNOS-39 AI Copilot E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test('API smoke — health, login, score, summarize', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');
    const health = await request.get(`${API_URL}/api/v1/ai/health`);
    const healthBody = (await health.json()) as { data?: { status?: string } };
    expect(healthBody.data?.status).toMatch(/ok|degraded/);

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);

    const token = await staffToken(request);
    const scores = await request.get(
      `${API_URL}/api/v1/ai/scores?entity_type=lead&entity_id=${leadId}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(scores.ok()).toBeTruthy();

    const brief = await request.post(`${API_URL}/api/v1/ai/summarize`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        context: 'lead_brief',
        entity_type: 'lead',
        entity_id: String(leadId),
      },
    });
    expect(brief.ok(), `lead_brief: ${brief.status()}`).toBeTruthy();
  });

  test('pilot walkthrough — 8 steps UAT (login → score → brief → summarize → draft approve → audit)', async ({
    page,
    request,
  }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);
    const token = await staffToken(request);
    const runsBefore = await fetchAgentRunCount(request, token);

    // Step 1 — login pilot user
    await loginAsStaff(page);

    // Step 2 — open lead detail (owner lead)
    await page.goto(`/crm/leads/${leadId}`);
    await expect(page).toHaveURL(new RegExp(`/crm/leads/${leadId}`));

    const copilot = copilotPanel(page);
    await expect(copilot).toBeVisible({ timeout: 20_000 });

    // Step 3 — score + explainability
    await waitForScoreCard(page);

    // Step 4 — lead brief (5 bullets)
    await copilot.getByRole('button', { name: 'Tóm tắt nhanh' }).click();
    await expect(copilot.locator('.ai-brief-result__summary')).toBeVisible({ timeout: 20_000 });
    const bullets = copilot.locator('.ai-brief-result__bullets li');
    const bulletCount = await bullets.count();
    expect(bulletCount).toBeGreaterThanOrEqual(1);
    expect(bulletCount).toBeLessThanOrEqual(5);

    // Step 5 — summarize activity (paste mode)
    const summarizeSection = copilot.getByRole('region', { name: 'Tóm tắt hoạt động' });
    await summarizeSection.getByRole('radio', { name: 'Dán nội dung' }).check();
    await summarizeSection.getByPlaceholder(/Dán ghi chú/i).fill(SUMMARIZE_PASTE_TEXT);
    await summarizeSection.getByRole('button', { name: 'Tóm tắt', exact: true }).click();
    await expect(summarizeSection.locator('.ai-summary-result')).toBeVisible({ timeout: 20_000 });

    // Step 6–7 — follow-up draft → edit → approve (BR-AI-01: activity note only)
    const followUp = copilot.getByRole('region', { name: 'Soạn follow-up' });
    await followUp.getByRole('radio', { name: 'Zalo' }).check();
    await followUp.getByRole('button', { name: 'Soạn nháp' }).click();
    const textarea = followUp.locator('textarea[aria-label="Nội dung nháp follow-up"]');
    await expect(textarea).toBeVisible({ timeout: 20_000 });
    await textarea.fill(`${await textarea.inputValue()}\n\nEm xin phép follow-up thêm thông tin ạ.`);
    await followUp.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(followUp.getByText(/Đã duyệt — ghi activity note/i)).toBeVisible({ timeout: 20_000 });

    await assertNoOutboundSendButtons(page);
    await expect(copilot.getByText(/Gợi ý AI — cần bạn duyệt/i)).toBeVisible();

    // Step 8 — audit trail has new runs (≥ brief + summarize + draft + health checks)
    const runsAfter = await fetchAgentRunCount(request, token);
    if (runsBefore === 0 && runsAfter === 0) {
      test.info().annotations.push({
        type: 'warning',
        description: 'GET /ai/runs unavailable — audit step skipped (enable PTT_CRM_INTERNAL_KEY + staff JWT)',
      });
    } else {
      expect(runsAfter).toBeGreaterThanOrEqual(runsBefore + 2);
    }
  });

  test('mobile — AI tab shows copilot shell', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);

    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsStaff(page);
    await page.goto(`/crm/leads/${leadId}`);

    await page.getByRole('tab', { name: 'AI' }).click({ force: true });
    await expect(copilotPanel(page)).toBeVisible({ timeout: 15_000 });
    await assertNoOutboundSendButtons(page);
  });

  test('BR-AI-01 — no outbound send controls in copilot (static audit)', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await loginAsStaff(page);
    await page.goto(`/crm/leads/${leadId}`);
    await expect(copilotPanel(page)).toBeVisible({ timeout: 20_000 });
    await assertNoOutboundSendButtons(page);
  });
});

test.describe('RNOS-39 follow-up draft API (RNOS-07)', () => {
  test.describe.configure({ mode: 'serial' });

  test('API — generate, list, accept creates activity note', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    const token = await staffToken(request);

    const draft = await request.post(`${API_URL}/api/v1/ai/recommendation`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        type: 'follow_up_draft',
        entity_type: 'lead',
        entity_id: String(leadId),
        channel_hint: 'zalo',
      },
    });
    expect(draft.ok(), `follow_up_draft: ${draft.status()} ${await draft.text()}`).toBeTruthy();
    const draftBody = (await draft.json()) as {
      data?: { id?: string; text?: string; status?: string };
    };
    expect(draftBody.data?.status).toBe('pending');

    const list = await request.get(
      `${API_URL}/api/v1/ai/recommendations?entity_type=lead&entity_id=${leadId}&status=pending&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(list.ok()).toBeTruthy();

    const accept = await request.patch(
      `${API_URL}/api/v1/ai/recommendations/${draftBody.data!.id}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: {
          status: 'accepted',
          final_text: draftBody.data!.text,
        },
      },
    );
    expect(accept.ok(), `accept draft: ${accept.status()} ${await accept.text()}`).toBeTruthy();
    const acceptBody = (await accept.json()) as { data?: { status?: string; activity_id?: number } };
    expect(acceptBody.data?.status).toBe('accepted');
    expect(acceptBody.data?.activity_id).toBeGreaterThan(0);
  });
});

test.describe('AI-UC-006 — GDKD override score (UI-R1-08)', () => {
  test.describe.configure({ mode: 'serial' });

  const OVERRIDE_REASON = 'E2E GDKD điều chỉnh score — VIP khách ưu tiên cao';
  const OVERRIDE_SCORE = 77;

  test('API — override score persists overridden_by + audit', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);
    const token = await staffToken(request);

    const override = await request.post(`${API_URL}/api/v1/ai/scores/lead/override`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        lead_id: leadId,
        score: OVERRIDE_SCORE,
        override_reason: OVERRIDE_REASON,
      },
    });
    expect(
      override.ok(),
      `override score: ${override.status()} ${await override.text()}`,
    ).toBeTruthy();
    const overrideBody = (await override.json()) as {
      data?: { score?: number; model_name?: string; score_id?: string };
    };
    expect(overrideBody.data?.score).toBe(OVERRIDE_SCORE);
    expect(overrideBody.data?.model_name).toBe('manual_override');
    expect(overrideBody.data?.score_id).toBeTruthy();

    const scores = await request.get(
      `${API_URL}/api/v1/ai/scores?entity_type=lead&entity_id=${leadId}&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(scores.ok()).toBeTruthy();
    const scoresBody = (await scores.json()) as {
      data?: {
        latest?: {
          score_value?: number;
          overridden_by?: string | null;
          override_reason?: string | null;
          model_name?: string | null;
        } | null;
      };
    };
    expect(scoresBody.data?.latest?.score_value).toBe(OVERRIDE_SCORE);
    expect(scoresBody.data?.latest?.overridden_by).toBeTruthy();
    expect(scoresBody.data?.latest?.override_reason).toBe(OVERRIDE_REASON);
    expect(scoresBody.data?.latest?.model_name).toBe('manual_override');
  });

  test('API — rejects override_reason shorter than 10 chars', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    const token = await staffToken(request);

    const res = await request.post(`${API_URL}/api/v1/ai/scores/lead/override`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { lead_id: leadId, score: 50, override_reason: 'ngắn' },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('override_reason_too_short');
  });

  test('UI — override modal updates score badge GDKD điều chỉnh', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);

    await loginAsStaff(page);
    await page.goto(`/crm/leads/${leadId}`);
    await expect(copilotPanel(page)).toBeVisible({ timeout: 20_000 });
    await waitForScoreCard(page);

    const scoreSection = copilotPanel(page).getByRole('region', { name: 'Điểm lead' });
    await scoreSection.getByRole('button', { name: 'Điều chỉnh score' }).click();

    const dialog = page.getByRole('dialog', { name: 'Điều chỉnh điểm lead' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Điểm override 0-100').fill(String(OVERRIDE_SCORE));
    await dialog.getByLabel('Lý do điều chỉnh score').fill(OVERRIDE_REASON);
    await dialog.getByRole('button', { name: 'Lưu điều chỉnh' }).click();

    await expect(scoreSection.locator('.ai-score-override-badge')).toBeVisible({ timeout: 15_000 });
    await expect(scoreSection.locator('.ai-score-gauge__value')).toHaveText(String(OVERRIDE_SCORE));
    await expect(scoreSection.getByText(/Đã lưu điều chỉnh GDKD/i)).toBeVisible();
  });
});

test.describe('AI-UC-011 — NBA on lead copilot (UI-R2-01)', () => {
  test.describe.configure({ mode: 'serial' });

  test('API — lead NBA with force + dismiss reason', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);
    const token = await staffToken(request);

    const nba = await request.post(`${API_URL}/api/v1/ai/next-best-action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { lead_id: leadId, entity_type: 'lead', entity_id: leadId, force: true },
    });
    expect(nba.ok(), `lead nba: ${nba.status()} ${await nba.text()}`).toBeTruthy();
    const nbaBody = (await nba.json()) as {
      data?: { recommendation_id?: string; entity_type?: string; action_label?: string };
    };
    expect(nbaBody.data?.entity_type).toBe('lead');
    expect(nbaBody.data?.recommendation_id).toBeTruthy();

    const dismiss = await request.patch(
      `${API_URL}/api/v1/ai/recommendations/${nbaBody.data!.recommendation_id}`,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        data: { status: 'dismissed', dismiss_reason: 'not_needed' },
      },
    );
    expect(dismiss.ok(), `dismiss nba: ${dismiss.status()}`).toBeTruthy();
  });

  test('UI — NBA card dismiss modal on copilot', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');

    const leadId = await resolveLeadId(request);
    await ensureLeadScored(request, leadId);
    const token = await staffToken(request);

    await request.post(`${API_URL}/api/v1/ai/next-best-action`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { lead_id: leadId, entity_type: 'lead', entity_id: leadId, force: true },
    });

    await loginAsStaff(page);
    await page.goto(`/crm/leads/${leadId}`);
    await expect(copilotPanel(page)).toBeVisible({ timeout: 20_000 });
    await waitForScoreCard(page);

    const nbaCard = copilotPanel(page).locator('.nba-card');
    await expect(nbaCard).toBeVisible({ timeout: 20_000 });
    await expect(nbaCard.locator('.nba-card__playbook-link')).toBeVisible();

    await nbaCard.getByRole('button', { name: 'Bỏ' }).click();
    const dialog = page.getByRole('dialog', { name: 'Lý do bỏ gợi ý' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Xác nhận bỏ' }).click();
    await expect(nbaCard).toHaveCount(0, { timeout: 15_000 });
  });
});
