import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { validateDocumentUrl } from '@/lib/security/document-validation';

/**
 * GET /api/school/admissions/[applicationId]/documents/[documentId]
 * 
 * Secure Document Access API.
 * 
 * Verifies:
 * 1. Authenticated user session
 * 2. Active school membership
 * 3. Authoritative server-side permission (ADMISSIONS_VIEW)
 * 4. Tenant isolation (application belongs to active schoolId)
 * 5. Document ownership (document belongs strictly to this applicationId)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string; documentId: string }> }
) {
  try {
    const { applicationId, documentId } = await params;
    const { schoolId } = await requirePermission(request, {
      permission: 'ADMISSIONS_VIEW',
    });

    const result = await withTenantContext(schoolId, async (tx) => {
      // 1. Verify application belongs to authenticated school
      const application = await tx.admissionApplication.findFirst({
        where: { id: applicationId, schoolId },
        select: { id: true, applicationNumber: true, schoolId: true },
      });

      if (!application) {
        throw { status: 404, message: 'ভর্তি আবেদনটি খুঁজে পাওয়া যায়নি।' };
      }

      // 2. Verify document belongs to this application
      const document = await tx.applicationDocument.findFirst({
        where: { id: documentId, applicationId },
        select: { id: true, title: true, fileUrl: true, createdAt: true },
      });

      if (!document) {
        throw { status: 404, message: 'সংযুক্ত নথিটি খুঁজে পাওয়া যায়নি।' };
      }

      return { application, document };
    });

    // 3. Validate URL safety against SSRF
    const urlValidation = validateDocumentUrl(result.document.fileUrl);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { success: false, error: 'নথির লিংকটি অনিরাপদ হিসেবে চিহ্নিত হয়েছে।' },
        { status: 400 }
      );
    }

    const response = NextResponse.json({
      success: true,
      data: {
        documentId: result.document.id,
        applicationId: result.application.id,
        applicationNumber: result.application.applicationNumber,
        title: result.document.title,
        fileUrl: result.document.fileUrl,
        createdAt: result.document.createdAt,
      },
    });

    // Security headers for sensitive document access
    response.headers.set('Content-Security-Policy', "default-src 'none'");
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    return response;
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    const e = error as Error;
    if (e.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'অননুমোদিত অ্যাক্সেস।' }, { status: 401 });
    }
    if (e.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json(
        { success: false, error: 'নথি দেখার অনুমতি আপনার নেই।' },
        { status: 403 }
      );
    }
    console.error('Admission Document Access Error:', error);
    return NextResponse.json(
      { success: false, error: 'নথি লোড করার সময় ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}
