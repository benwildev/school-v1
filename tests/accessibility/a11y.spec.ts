import { test, expect } from '@playwright/test';

test.describe('Accessibility & Keyboard Navigation (WCAG 2.2)', () => {
  test('TC-A11Y-01: Login page has accessible form controls and unique H1', async ({ page }) => {
    await page.goto('/login');

    // Exactly one H1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Form inputs must have labels or aria-labels
    const identifierInput = page.locator('#identifier');
    await expect(identifierInput).toBeVisible();
    const identifierLabel = page.locator('label[for="identifier"]');
    await expect(identifierLabel).toBeVisible();

    const passwordInput = page.locator('#password');
    await expect(passwordInput).toBeVisible();
    const passwordLabel = page.locator('label[for="password"]');
    await expect(passwordLabel).toBeVisible();

    // Submit button must have accessible name
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toHaveText(/লগইন করুন|Sign in/i);
  });

  test('TC-A11Y-02: Dashboard has semantic H1 heading and accessible navigation', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 10000 });
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // Nav landmark is present
    const nav = page.locator('nav').first();
    await expect(nav).toBeAttached();

    // Main landmark is visible
    const main = page.locator('main').first();
    await expect(main).toBeVisible();
  });

  test('TC-A11Y-03: Keyboard Escape closes mobile drawer when open', async ({ page }) => {
    const viewportSize = page.viewportSize();
    if (!viewportSize || viewportSize.width >= 768) {
      test.skip();
      return;
    }

    await page.goto('/login');
    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const openBtn = page.locator('button[aria-label*="মেনু খুলুন"], button[aria-label*="Open menu"]').first();
    await openBtn.click();

    const closeBtn = page.locator('#mobile-drawer-close-btn');
    await expect(closeBtn).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await expect(closeBtn).not.toBeVisible();
  });
});
