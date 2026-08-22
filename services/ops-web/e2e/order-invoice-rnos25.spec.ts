import { test, expect } from '@playwright/test';
import { API_URL, apiReachable, loginAsStaff, staffToken } from './helpers/ai-copilot-helpers';

test.describe('RNOS-25 Order/Invoice', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/orders and /crm/invoices pages render', async ({ page }) => {
    await page.goto('/crm/orders');
    await expect(page.getByTestId('orders-table')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1, name: /Đơn hàng/i })).toBeVisible();

    await page.goto('/crm/invoices');
    await expect(page.getByTestId('invoices-table')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1, name: /Hóa đơn/i })).toBeVisible();
  });

  test('API — GET orders + invoices list', async ({ request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    const token = await staffToken(request);

    const ordersRes = await request.get(`${API_URL}/api/crm/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(ordersRes.ok(), `orders: ${ordersRes.status()} ${await ordersRes.text()}`).toBeTruthy();
    const ordersBody = (await ordersRes.json()) as { orders?: unknown[] };
    expect(Array.isArray(ordersBody.orders)).toBeTruthy();

    const invoicesRes = await request.get(`${API_URL}/api/crm/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(invoicesRes.ok(), `invoices: ${invoicesRes.status()} ${await invoicesRes.text()}`).toBeTruthy();
    const invoicesBody = (await invoicesRes.json()) as { invoices?: unknown[] };
    expect(Array.isArray(invoicesBody.invoices)).toBeTruthy();
  });
});
