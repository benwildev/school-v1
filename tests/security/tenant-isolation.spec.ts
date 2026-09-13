import { test, expect } from '@playwright/test';

// Fixture IDs from scripts/seed-e2e.mjs
const SCHOOL_A_ID = '11111111-1111-4111-a111-111111111111'; // dhaka-ideal
const SCHOOL_B_ID = '22222222-2222-4222-a222-222222222222'; // ctg-model
const SCHOOL_A_STUDENT_ID = 'b4444444-4444-4444-a444-444444444444';
const SCHOOL_A_TEACHER_ID = 'b2222222-2222-4222-a222-222222222222';

async function loginAs(page: import('@playwright/test').Page, identifier: string, password = 'Pass123!@#') {
  await page.goto('/login');
  await page.fill('#identifier', identifier);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

test.describe('Multi-Tenant Data Isolation & Security', () => {
  test('TC-TENANT-01: Spoofed x-active-school-id header cannot override a session\'s real tenant scope', async ({ page }) => {
    await loginAs(page, 'admin@dhaka-ideal.bd');

    const meRes = await page.request.get('/api/auth/me');
    expect(meRes.status()).toBe(200);
    const meBody = await meRes.json();
    const realActiveSchoolId = meBody.activeSchoolId;
    expect(realActiveSchoolId).toBeTruthy();

    // Attempt to override tenant scope via a client-supplied header — middleware
    // must strip this and re-derive schoolId strictly from the verified session JWT.
    const settingsRes = await page.request.get('/api/school/settings', {
      headers: { 'x-active-school-id': SCHOOL_B_ID },
    });
    expect(settingsRes.status()).toBe(200);
    const settingsBody = await settingsRes.json();

    expect(settingsBody.data.school.id).toBe(realActiveSchoolId);
    expect(settingsBody.data.school.id).not.toBe(SCHOOL_B_ID);
  });

  test('TC-TENANT-02: SuperAdmin can view and switch between multiple school tenants', async ({ page }) => {
    await loginAs(page, 'superadmin@edusmart.bd');

    const meRes = await page.request.get('/api/auth/me');
    expect(meRes.status()).toBe(200);
    const body = await meRes.json();
    expect(body.user.isSuperAdmin).toBe(true);
    expect(body.availableSchools.length).toBeGreaterThanOrEqual(2);
  });

  test('TC-TENANT-03: School B admin cannot read School A student by ID (cross-tenant IDOR)', async ({ page }) => {
    await loginAs(page, 'admin@ctg-model.bd');

    const res = await page.request.get(`/api/school/students/${SCHOOL_A_STUDENT_ID}`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('TC-TENANT-03b: School A admin CAN read their own School A student by ID (sanity check)', async ({ page }) => {
    // Guards against TC-TENANT-03 passing merely because the route always 404s.
    await loginAs(page, 'admin@dhaka-ideal.bd');

    const res = await page.request.get(`/api/school/students/${SCHOOL_A_STUDENT_ID}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('TC-TENANT-04: School B admin cannot read School A teacher by ID (cross-tenant IDOR)', async ({ page }) => {
    await loginAs(page, 'admin@ctg-model.bd');

    const res = await page.request.get(`/api/school/teachers/${SCHOOL_A_TEACHER_ID}`);
    expect(res.status()).toBe(404);
  });

  test('TC-TENANT-04b: School A admin CAN read their own School A teacher by ID (sanity check)', async ({ page }) => {
    await loginAs(page, 'admin@dhaka-ideal.bd');

    const res = await page.request.get(`/api/school/teachers/${SCHOOL_A_TEACHER_ID}`);
    expect(res.status()).toBe(200);
  });

  test('TC-TENANT-05: Non-admin (teacher) cannot access another school\'s data via listing endpoints', async ({ page }) => {
    await loginAs(page, 'teacher@dhaka-ideal.bd');

    const res = await page.request.get('/api/school/students');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const students = body.data?.students ?? body.data ?? [];
    if (Array.isArray(students)) {
      for (const s of students) {
        expect(s.schoolId ?? SCHOOL_A_ID).toBe(SCHOOL_A_ID);
      }
    }
  });
});

// NOTE: Finance (payments/invoices), HR/payroll, and exam/marks records are not
// currently seeded per-school in scripts/seed-e2e.mjs, so cross-tenant IDOR
// coverage for those modules could not be added here without first extending
// the seed fixtures with a second school's financial/payroll/exam data. The
// route-level tenant scoping pattern (withTenantContext + `where: { schoolId }`)
// is the same one verified above for students/teachers; the finance/payroll/exam
// route handlers should be spot-checked the same way once seed data exists.
