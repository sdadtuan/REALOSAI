import { test, expect } from '@playwright/test';
import {
  API_URL,
  apiReachable,
  loginAsStaff,
  resolveLeadId,
  staffToken,
} from './helpers/ai-copilot-helpers';

/**
 * RNOS-29 — AI acceptance feedback loop (analytics tile, inbox, dismiss reason modal).
 */
test.describe('RNOS-29 AI feedback loop', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/kpi shows AI acceptance tile (G6)', async ({ page }) => {
    await page.goto('/crm/kpi');
    await expect(page.locator('.kpi-tile-grid')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.kpi-tile-grid').getByText(/Tỷ lệ chấp nhận AI/i)).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('/crm/ai/insights shows feedback inbox', async ({ page }) => {
    await page.goto('/crm/ai/insights');
    await expect(page.getByRole('heading', { level: 3, name: /Inbox gợi ý AI/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(/Chưa có gợi ý AI|Inbox gợi ý AI \(\d+\)/i).first(),
    ).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('dismiss modal captures preset reason on follow-up draft', async ({ page, request }) => {
    const leadId = await resolveLeadId(request);
    await page.goto(`/crm/leads/${leadId}`);
    const followUp = page.getByRole('region', { name: 'Soạn follow-up' });
    await expect(followUp).toBeVisible({ timeout: 20_000 });
    await followUp.getByRole('button', { name: 'Soạn nháp' }).click();
    await expect(followUp.locator('textarea[aria-label="Nội dung nháp follow-up"]')).toBeVisible({
      timeout: 20_000,
    });
    await followUp.getByRole('button', { name: 'Bỏ', exact: true }).click();
    const modal = page.getByRole('dialog', { name: /Lý do bỏ gợi ý/i });
    await expect(modal).toBeVisible();
    await modal.getByRole('radio', { name: 'Sai tone' }).check();
    await modal.getByRole('button', { name: 'Xác nhận bỏ' }).click();
    await expect(followUp.getByText(/feedback đã ghi nhận/i)).toBeVisible({ timeout: 20_000 });
  });

  test('API — analytics acceptance endpoint', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest AI API not reachable');
    const token = await staffToken(request);
    const res = await request.get(`${API_URL}/api/v1/ai/analytics/acceptance?days=7`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status() === 503) {
      test.info().annotations.push({
        type: 'warning',
        description: 'ai_recommendations schema not ready — analytics skipped',
      });
      return;
    }
    expect(res.ok(), `acceptance analytics: ${res.status()} ${await res.text()}`).toBeTruthy();
    const body = (await res.json()) as { data?: { accepted?: number; dismissed?: number } };
    expect(body.data).toBeTruthy();
  });
});
