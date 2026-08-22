import { test, expect } from '@playwright/test';

const OPS = process.env.OPS_E2E_URL ?? 'https://rs.pttads.vn';
const PASS = process.env.OPS_E2E_STAFF_PASSWORD ?? process.env.ADMIN_PASSWORD ?? '';

const ACCOUNTS = {
  admin: process.env.OPS_E2E_ADMIN_EMAIL ?? 'admin@pttads.vn',
  content: process.env.OPS_E2E_CONTENT_EMAIL ?? 'win1-content@pttads.vn',
  design: process.env.OPS_E2E_DESIGN_EMAIL ?? 'win1-design@pttads.vn',
};

async function login(page: import('@playwright/test').Page, email: string) {
  if (!PASS || PASS.length < 8) {
    test.skip(true, 'Set OPS_E2E_STAFF_PASSWORD or ADMIN_PASSWORD');
  }
  await page.goto(`${OPS}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PASS);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });
}

async function sidebarLinkLabels(page: import('@playwright/test').Page): Promise<string[]> {
  const expand = page.getByRole('button', { name: 'Mở rộng menu' });
  if (await expand.isVisible()) {
    await expand.click();
  }
  await page.waitForTimeout(400);
  const buttons = page.locator('nav .ops-nav-link--button');
  const texts = await buttons.allTextContents();
  return texts.map((t) => t.trim()).filter(Boolean);
}

test.describe('WIN-1 Manual UAT — VUX-02/04/05', () => {
  test('VUX-02 — mobile leads 390px (content user)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.content);
    await page.goto(`${OPS}/crm/leads`);
    await page.waitForLoadState('domcontentloaded');

    const mobileList = page.locator('.win-leads-mobile-list');
    await expect(mobileList).toBeVisible({ timeout: 15000 });

    const bodyScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2);
    expect(bodyScroll).toBeTruthy();

    const callBtn = page.getByRole('link', { name: 'Gọi' }).first();
    const detailBtn = page.getByRole('link', { name: 'Chi tiết' }).first();
    if (await callBtn.count()) {
      await expect(callBtn).toBeVisible();
      await expect(detailBtn).toBeVisible();
    }

    const chip = page.locator('.win-filter-chips button, .win-filter-chips .chip').first();
    if (await chip.count()) {
      await expect(chip).toBeVisible();
      await chip.click();
    }
  });

  test('VUX-04 — content vs design menu + badge', async ({ browser }) => {
    const contentCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const designCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const contentPage = await contentCtx.newPage();
    const designPage = await designCtx.newPage();

    await login(contentPage, ACCOUNTS.content);
    await login(designPage, ACCOUNTS.design);

    await contentPage.goto(`${OPS}/crm/leads`);
    await designPage.goto(`${OPS}/crm/leads`);

    const contentBadge = contentPage.locator('.win-badge-rbac').first();
    const designBadge = designPage.locator('.win-badge-rbac').first();
    await expect(contentBadge).toContainText(/content|MKT-02/i);
    await expect(designBadge).toContainText(/design|MKT-02/i);

    const contentNav = new Set(await sidebarLinkLabels(contentPage));
    const designNav = new Set(await sidebarLinkLabels(designPage));
    const onlyContent = [...contentNav].filter((x) => !designNav.has(x));
    const onlyDesign = [...designNav].filter((x) => !contentNav.has(x));
    expect(contentNav.size).toBeGreaterThan(0);
    expect(designNav.size).toBeGreaterThan(0);
    expect(onlyContent.length + onlyDesign.length).toBeGreaterThan(0);

    await contentCtx.close();
    await designCtx.close();
  });

  test('VUX-05 — SoD UI blocks save (admin)', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await page.goto(`${OPS}/admin/crm/permissions/users`);
    await page.waitForLoadState('domcontentloaded');

    const compliance = page.locator('.job-function-picker__item').filter({ hasText: 'compliance' });
    const content = page.locator('.job-function-picker__item').filter({ hasText: /^content/ });
    if ((await compliance.count()) && (await content.count())) {
      await content.locator('input[type="checkbox"]').check();
      await compliance.locator('input[type="checkbox"]').check();
      await expect(page.locator('.win-sod-banner')).toBeVisible();
      await expect(page.getByRole('button', { name: /Lưu job functions/i })).toBeDisabled();
    }

    await page.goto(`${OPS}/admin/crm/permissions/functions`);
    await page.waitForLoadState('domcontentloaded');

    const fnSelect = page.locator('select').first();
    if (await fnSelect.count()) {
      await fnSelect.selectOption({ label: /content/i }).catch(async () => {
        await fnSelect.selectOption({ index: 2 });
      });
      await page.waitForTimeout(500);
      const writeRow = page.locator('tr').filter({ hasText: /crm_seo_aeo_write|SEO write/i }).first();
      const approveRow = page.locator('tr').filter({ hasText: /crm_seo_aeo_approve|SEO approve/i }).first();
      if ((await writeRow.count()) && (await approveRow.count())) {
        for (const action of ['create', 'edit']) {
          const cb = writeRow.locator('input[type="checkbox"]').filter({ has: page.locator(`[value="${action}"]`) });
          if (await cb.count()) await cb.first().check({ force: true }).catch(() => {});
        }
        const approveCb = approveRow.locator('input[type="checkbox"]').filter({ hasText: /approve/i });
        if (await approveCb.count()) await approveCb.first().check({ force: true }).catch(() => {});
        await expect(page.getByRole('button', { name: /Lưu ma trận function/i })).toBeDisabled();
      }
    }
  });
});
