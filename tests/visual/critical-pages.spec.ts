import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Visual Screenshots of Critical Pages', () => {
  test.beforeAll(async () => {
    const dir = path.resolve('playwright-screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  test('TC-VIS-01: Capture Login Page Screenshot', async ({ page }, testInfo) => {
    await page.goto('/login');
    const projectName = testInfo.project.name.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `playwright-screenshots/login_${projectName}.png`, fullPage: true });
  });

  test('TC-VIS-02: Capture Unauthorized Page Screenshot', async ({ page }, testInfo) => {
    await page.goto('/unauthorized');
    const projectName = testInfo.project.name.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `playwright-screenshots/unauthorized_${projectName}.png`, fullPage: true });
  });

  test('TC-VIS-03: Capture Admin Dashboard Screenshot', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.fill('#identifier', 'admin@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const projectName = testInfo.project.name.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `playwright-screenshots/admin_dashboard_${projectName}.png`, fullPage: true });
  });

  test('TC-VIS-04: Capture Teacher Dashboard Screenshot', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.fill('#identifier', 'teacher@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const projectName = testInfo.project.name.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `playwright-screenshots/teacher_dashboard_${projectName}.png`, fullPage: true });
  });

  test('TC-VIS-05: Capture Student Portal Screenshot', async ({ page }, testInfo) => {
    await page.goto('/login');
    await page.fill('#identifier', 'student@dhaka-ideal.bd');
    await page.fill('#password', 'Pass123!@#');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    const projectName = testInfo.project.name.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `playwright-screenshots/student_dashboard_${projectName}.png`, fullPage: true });
  });
});
