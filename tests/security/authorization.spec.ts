import { test, expect } from '@playwright/test';

test.describe('Direct URL & API Authorization Guards', () => {
  test('TC-SEC-01: Unauthenticated request to /api/auth/me returns 401 Unauthorized', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('TC-SEC-02: Friendly 403 Unauthorized page renders non-technical bilingual message', async ({ page }) => {
    await page.goto('/unauthorized');
    await expect(page).toHaveTitle(/অনুমোদন সীমাবদ্ধ|Access Restricted|EduSmart/i);

    const h1 = page.locator('h1');
    await expect(h1).toContainText(/অনুমোদন সীমাবদ্ধ|Access Restricted/i);

    // Verify back to dashboard button
    const returnBtn = page.locator('a:has-text("মূল ড্যাশবোর্ডে ফিরুন"), a:has-text("ড্যাশবোর্ড")').first();
    await expect(returnBtn).toBeVisible();
  });

  test('TC-SEC-03: Direct access to protected dashboard redirects unauthenticated visitor to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');
  });
});
