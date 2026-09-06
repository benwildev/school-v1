import { test, expect } from '@playwright/test';

test.describe('Multi-Tenant Data Isolation & Security', () => {
  test('TC-TENANT-01: School A Admin cannot switch to School B tenant', async ({ page }) => {
    // Login as School A Admin
    await page.goto('/login');
    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Try to switch to School B via API with the active session
    const schoolBId = '22222222-2222-4222-a222-222222222222';
    const switchRes = await page.request.post('/api/auth/switch-school', {
      data: { schoolId: schoolBId },
    });

    // Should return 403 Forbidden
    expect(switchRes.status()).toBe(403);
    const body = await switchRes.json();
    expect(body.success).toBe(false);
  });

  test('TC-TENANT-02: SuperAdmin can view and switch between multiple school tenants', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'superadmin@edusmart.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const meRes = await page.request.get('/api/auth/me');
    expect(meRes.status()).toBe(200);
    const body = await meRes.json();
    expect(body.user.isSuperAdmin).toBe(true);
    expect(body.availableSchools.length).toBeGreaterThanOrEqual(2);
  });
});
