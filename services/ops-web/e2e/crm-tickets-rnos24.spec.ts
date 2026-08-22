import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

/**
 * RNOS-24 — CRM tickets lite CRUD + sentiment smoke.
 */
test.describe('RNOS-24 CRM tickets', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/tickets shows table, filters, and create form', async ({ page }) => {
    await page.goto('/crm/tickets');
    await expect(page.getByRole('heading', { level: 2, name: /ticket cs lite/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('.crm-tickets-table')).toBeVisible();
    await expect(page.getByRole('button', { name: /tạo ticket/i })).toBeVisible();
    await expect(page.locator('select').filter({ hasText: /sentiment/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
  });

  test('complaint ticket gets negative sentiment chip', async ({ page }) => {
    await page.goto('/crm/tickets');
    await expect(page.getByRole('heading', { level: 2, name: /ticket cs lite/i })).toBeVisible({
      timeout: 20_000,
    });

    const customerSelect = page.locator('form.admin-crm-form select').first();
    await expect(customerSelect).toBeVisible();
    const options = customerSelect.locator('option');
    const optionCount = await options.count();
    test.skip(optionCount < 2, 'No customers available for ticket create');

    await customerSelect.selectOption({ index: 1 });
    await page.locator('form.admin-crm-form select').nth(1).selectOption('phan_nan');
    await page.locator('form.admin-crm-form input[placeholder="Tiêu đề ticket"]').fill(
      `E2E complaint ${Date.now()}`,
    );
    await page
      .locator('form.admin-crm-form textarea')
      .fill('Rat te, khong hai long, muon hoan tien ngay');

    await page.getByRole('button', { name: /tạo ticket/i }).click();
    await expect(page.getByText(/đã tạo ticket/i)).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('.crm-tickets-sentiment--negative').first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
