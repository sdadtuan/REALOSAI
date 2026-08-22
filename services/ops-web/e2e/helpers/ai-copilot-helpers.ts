import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const STAFF_EMAIL = process.env.OPS_E2E_STAFF_EMAIL ?? 'staff@demo.local';
export const STAFF_PASSWORD = process.env.OPS_E2E_STAFF_PASSWORD ?? 'demo12345';
export const API_URL = (process.env.OPS_E2E_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
export const LEAD_ID_ENV = process.env.OPS_E2E_AI_LEAD_ID ?? '9000050';

export const SUMMARIZE_PASTE_TEXT =
  'Khách hàng hỏi về gói dịch vụ quảng cáo Meta và muốn báo giá chi tiết qua Zalo trong tuần tới. ';

export const OUTBOUND_BUTTON =
  /gửi zalo|gửi email|gửi sms|send (email|sms|message)|gửi tin nhắn/i;

export async function apiReachable(request: APIRequestContext): Promise<boolean> {
  try {
    const health = await request.get(`${API_URL}/api/v1/ai/health`, { timeout: 8_000 });
    return health.ok();
  } catch {
    return false;
  }
}

export async function staffToken(request: APIRequestContext): Promise<string> {
  const login = await request.post(`${API_URL}/api/v1/staff/auth/login`, {
    data: { email: STAFF_EMAIL, password: STAFF_PASSWORD },
  });
  expect(login.ok(), `staff login: ${login.status()} ${await login.text()}`).toBeTruthy();
  const body = (await login.json()) as { access_token?: string };
  expect(body.access_token).toBeTruthy();
  return body.access_token!;
}

export async function loginAsStaff(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(STAFF_EMAIL);
  await page.locator('#password').fill(STAFF_PASSWORD);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

export async function resolveLeadId(request: APIRequestContext): Promise<number> {
  const parsed = Number(LEAD_ID_ENV);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  const token = await staffToken(request);
  const res = await request.get(`${API_URL}/api/v1/leads?limit=1&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `list leads: ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { leads?: Array<{ id?: number }> };
  const id = body.leads?.[0]?.id;
  expect(id, 'No leads in API — set OPS_E2E_AI_LEAD_ID').toBeTruthy();
  return id!;
}

export async function ensureLeadScored(request: APIRequestContext, leadId: number): Promise<void> {
  const token = await staffToken(request);
  const scoresUrl = `${API_URL}/api/v1/ai/scores?entity_type=lead&entity_id=${leadId}&limit=1`;

  async function hasLatestScore(): Promise<boolean> {
    const res = await request.get(scoresUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok()) return false;
    const body = (await res.json()) as { data?: { latest?: { score_value?: number } | null } };
    return body.data?.latest != null;
  }

  if (await hasLatestScore()) {
    return;
  }

  const res = await request.post(`${API_URL}/api/v1/ai/score/lead`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { lead_id: leadId },
  });

  if (!res.ok() && !(await hasLatestScore())) {
    expect(
      res.ok(),
      `score lead: ${res.status()} ${await res.text()} — ensure lead ${leadId} exists and staff has access`,
    ).toBeTruthy();
  }
}

export function copilotPanel(page: Page) {
  return page.getByRole('complementary', { name: 'AI Copilot' });
}

export async function assertNoOutboundSendButtons(page: Page): Promise<void> {
  const copilot = copilotPanel(page);
  await expect(copilot.getByRole('button', { name: OUTBOUND_BUTTON })).toHaveCount(0);
  await expect(page.getByRole('button', { name: OUTBOUND_BUTTON })).toHaveCount(0);
}

export async function waitForScoreCard(page: Page): Promise<void> {
  const copilot = copilotPanel(page);
  const scoreSection = copilot.getByRole('region', { name: 'Điểm lead' });
  await expect(scoreSection).toBeVisible();
  await expect
    .poll(
      async () => {
        const hasGauge = await scoreSection.locator('.ai-score-gauge__value').count();
        const hasEmpty = await scoreSection.getByText(/Chưa có điểm/i).count();
        const hasPending = await scoreSection.getByText(/Score đang cập nhật/i).count();
        return hasGauge > 0 || hasEmpty > 0 || hasPending > 0;
      },
      { timeout: 35_000, message: 'Score card should show gauge, empty, or pending state' },
    )
    .toBeTruthy();
}

export async function fetchAgentRunCount(request: APIRequestContext, token: string): Promise<number> {
  const res = await request.get(`${API_URL}/api/v1/ai/runs?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) {
    return 0;
  }
  const body = (await res.json()) as { data?: { runs?: unknown[] } };
  return body.data?.runs?.length ?? 0;
}
