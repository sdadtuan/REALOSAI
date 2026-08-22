import { test, expect } from '@playwright/test';
import { API_URL, LEAD_ID_ENV, apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

/**
 * UI-R1-10 — AI Score column on /crm/leads
 */
test.describe('UI-R1-10 Lead list score column', () => {
  test('batch scores API returns map for lead', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');

    const token = await staffToken(request);
    const leadId = LEAD_ID_ENV;
    const res = await request.get(
      `${API_URL}/api/v1/ai/scores/batch?entity_type=lead&entity_ids=${leadId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.data?.scores_by_entity_id).toBeTruthy();
  });

  test('leads page shows AI Score column with badge', async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
    await page.goto('/crm/leads');
    await expect(page.getByRole('columnheader', { name: 'AI Score' })).toBeVisible({ timeout: 20_000 });
    const badge = page.locator('.lead-score-badge').first();
    await expect(badge).toBeVisible({ timeout: 20_000 });
    await expect(badge.locator('.lead-score-badge__value')).not.toHaveText('—');
  });
});
