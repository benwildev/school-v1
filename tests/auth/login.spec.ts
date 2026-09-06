import { test, expect } from '@playwright/test';

test.describe('Authentication & Session Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await page.context().clearCookies();
  });

  test('TC-AUTH-01: Admin Login with valid credentials redirects to Dashboard', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/EduSmart BD|লগইন/);

    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('h1')).toContainText(/ড্যাশবোর্ড|Welcome|Principal Rahman/);
  });

  test('TC-AUTH-02: Teacher Login with valid credentials lands on Teacher Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'teacher@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/শিক্ষক|Teacher|Kazi Farhana/);
  });

  test('TC-AUTH-03: Accountant Login lands on Finance/Accountant Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'accountant@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/হিসাবরক্ষক|Accountant|Shafiqul/);
  });

  test('TC-AUTH-04: Student Login lands on Student Portal Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'student@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/শিক্ষার্থী|Student|Tanvir/);
  });

  test('TC-AUTH-05: Parent Login lands on Parent Portal Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'parent@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page.locator('body')).toContainText(/অভিভাবক|Parent|Rafiqul/);
  });

  test('TC-AUTH-06: Invalid password displays accessible error message without redirecting', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    const alert = page.locator('#login-error-alert');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText(/ভুল|Invalid/i);
    expect(page.url()).toContain('/login');
  });

  test('TC-AUTH-07: Show/hide password toggle reveals and masks password field', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('#password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = page.locator('button[aria-label="Show password"], button[aria-label="Hide password"]').first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');

      await toggleBtn.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    }
  });

  test('TC-AUTH-08: Logout clears session and redirects back to Login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Find and click Logout button
    const logoutBtn = page.locator('#header-logout-button');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    await page.waitForURL('**/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');

    // Attempt to navigate directly to /dashboard - should redirect or show login
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    // Unauthenticated user is redirected to login
    expect(page.url()).toContain('/login');
  });
});
