import { test, expect, Page } from '@playwright/test';

async function getNavLocator(page: Page) {
  const viewportSize = page.viewportSize();
  if (viewportSize && viewportSize.width < 768) {
    const openBtn = page.locator('button[aria-label="Open menu"], button[aria-label*="মেনু খুলুন"]').first();
    if (await openBtn.isVisible()) {
      await openBtn.click();
      await page.waitForTimeout(300);
    }
    return page.locator('.fixed.inset-y-0.left-0, .fixed.inset-0.z-50');
  }
  return page.locator('aside').first();
}

test.describe('Role-Based Navigation & Menu Filtering', () => {
  test('TC-NAV-01: Admin sees all administrative navigation modules', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const nav = await getNavLocator(page);
    await expect(nav).toContainText(/একাডেমিক|Academics/i);
    await expect(nav).toContainText(/উপস্থিতি|Attendance/i);
    await expect(nav).toContainText(/অর্থায়ন|Finance/i);
    await expect(nav).toContainText(/লজিস্টিকস|অপারেশন|Operations/i);
    await expect(nav).toContainText(/রিপোর্ট|ইন্টেলিজেন্স|Reports/i);
    await expect(nav).toContainText(/সেটিংস|Settings/i);
  });

  test('TC-NAV-02: Teacher sees Academic/Attendance modules but NOT Finance or Settings', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'teacher@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const nav = await getNavLocator(page);
    await expect(nav).toContainText(/একাডেমিক|Academics/i);
    await expect(nav).toContainText(/উপস্থিতি|Attendance/i);

    // Should NOT contain Finance or System Settings
    await expect(nav).not.toContainText(/ফি ও অর্থায়ন/i);
    await expect(nav).not.toContainText(/বিদ্যালয় সেটিংস/i);
  });

  test('TC-NAV-03: Accountant sees Finance modules but NOT Exam/Academics modules', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'accountant@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const nav = await getNavLocator(page);
    await expect(nav).toContainText(/ফি ও অর্থায়ন|Finance/i);
    await expect(nav).toContainText(/বেতন ও পেরোল|Payroll/i);

    // Should NOT contain Exam management or Academics management
    await expect(nav).not.toContainText(/পরীক্ষা ও রুটিন|নম্বর এন্ট্রি/i);
    await expect(nav).not.toContainText(/বিদ্যালয় সেটিংস/i);
  });

  test('TC-NAV-04: Student sees only Student Portal navigation links', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'student@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const nav = await getNavLocator(page);
    await expect(nav).toContainText(/শিক্ষার্থী পোর্টাল|Student Portal/i);

    const body = page.locator('body');
    await expect(body).toContainText(/আমার প্রোফাইল ও ভর্তি|শিক্ষার্থী পোর্টাল/i);

    // Administrative modules must NOT be present
    await expect(nav).not.toContainText(/বিদ্যালয় সেটিংস|School Settings/i);
    await expect(nav).not.toContainText(/বেতন ও পেরোল|Payroll/i);
    await expect(nav).not.toContainText(/এইচআর ও কর্মী/i);
  });

  test('TC-NAV-05: Parent sees only Parent Portal navigation links', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#identifier', 'parent@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const nav = await getNavLocator(page);
    await expect(nav).toContainText(/অভিভাবক পোর্টাল|Parent Portal/i);

    const body = page.locator('body');
    await expect(body).toContainText(/আমার সন্তানগণ|Parent/i);

    // Administrative modules must NOT be present
    await expect(nav).not.toContainText(/এইচআর ও কর্মী|HR/i);
    await expect(nav).not.toContainText(/ইনভেন্টরি|Inventory/i);
    await expect(nav).not.toContainText(/বিদ্যালয় সেটিংস/i);
  });
});
