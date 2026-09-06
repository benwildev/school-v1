import { test, expect } from '@playwright/test';

test.describe('Responsive Design & Viewport Adaptability', () => {
  test('TC-RESP-01: Zero horizontal scroll on Login page across all viewports', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });

  test('TC-RESP-02: Zero horizontal scroll on Dashboard across all viewports', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });

  test('TC-RESP-03: Mobile hamburger menu toggles slide-out drawer on small screens', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const viewportSize = page.viewportSize();
    const isMobile = viewportSize && viewportSize.width < 768;

    if (isMobile) {
      const openBtn = page.locator('button[aria-label*="মেনু খুলুন"], button[aria-label*="Open menu"]').first();
      await expect(openBtn).toBeVisible();

      // Click to open drawer
      await openBtn.click();
      const closeBtn = page.locator('#mobile-drawer-close-btn');
      await expect(closeBtn).toBeVisible();

      // Click to close drawer
      await closeBtn.click();
      await expect(closeBtn).not.toBeVisible();
    }
  });
});
