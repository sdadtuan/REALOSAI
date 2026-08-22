import { test, expect } from '@playwright/test';

test('PACK/UI off hides BĐS nav', async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_PTT_BDS_UI === '1', 'staging UI on');
  await page.goto('/crm/leads');
  await expect(page.getByRole('link', { name: 'Tổng quan' })).toHaveCount(0);
});
