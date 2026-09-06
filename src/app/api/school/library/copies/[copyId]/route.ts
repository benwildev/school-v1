import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { UpdateLibraryBookCopySchema } from '@/lib/validation/library';
import { isValidCopyStatusTransition } from '@/lib/library/book-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ copyId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });
    const { copyId } = await params;

    const copy = await withTenantContext(schoolId, async (tx) => {
      return tx.libraryBookCopy.findFirst({
        where: { id: copyId, schoolId },
        include: {
          book: {
            include: {
              category: true,
              author: true,
              publisher: true,
            },
          },
          campus: true,
          loans: {
            include: {
              student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
              employee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
            },
            orderBy: { issueDate: 'desc' },
            take: 10,
          },
        },
      });
    });

    if (!copy) {
      return NextResponse.json({ success: false, error: 'Book copy not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: copy });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ copyId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_MANAGE_CATALOG' });
    const { copyId } = await params;

    const body = await request.json();
    const parsed = UpdateLibraryBookCopySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await withTenantContext(schoolId, async (tx) => {
      const copy = await tx.libraryBookCopy.findFirst({
        where: { id: copyId, schoolId },
      });
      if (!copy) throw new Error('Book copy not found');

      if (parsed.data.status && parsed.data.status !== copy.status) {
        // Enforce valid lifecycle transitions
        const check = isValidCopyStatusTransition(copy.status, parsed.data.status);
        if (!check.valid) {
          throw new Error(check.reason || `Invalid status transition from ${copy.status} to ${parsed.data.status}`);
        }
      }

      return tx.libraryBookCopy.update({
        where: { id: copyId },
        data: parsed.data,
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
