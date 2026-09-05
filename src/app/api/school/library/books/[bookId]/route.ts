import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { UpdateLibraryBookSchema } from '@/lib/validation/library';
import { validateIsbn } from '@/lib/library/book-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });
    const { bookId } = await params;

    const book = await withTenantContext(schoolId, async () => {
      return prisma.libraryBook.findFirst({
        where: { id: bookId, schoolId },
        include: {
          category: true,
          author: true,
          publisher: true,
          copies: {
            include: {
              campus: { select: { id: true, nameEn: true, nameBn: true } },
              loans: {
                where: { status: { in: ['ISSUED', 'OVERDUE'] } },
                include: {
                  student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
                  employee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
                },
              },
            },
            orderBy: { accessionNumber: 'asc' },
          },
          reservations: {
            where: { status: 'PENDING' },
            include: {
              student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
              employee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
            },
            orderBy: { reservationDate: 'asc' },
          },
        },
      });
    });

    if (!book) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: book });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_MANAGE_CATALOG' });
    const { bookId } = await params;

    const body = await request.json();
    const parsed = UpdateLibraryBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { isbn10, isbn13 } = parsed.data;
    if (isbn10) {
      const isbnCheck = validateIsbn(isbn10);
      if (!isbnCheck.valid) {
        return NextResponse.json({ success: false, error: `Invalid ISBN-10: ${isbnCheck.error}` }, { status: 400 });
      }
    }
    if (isbn13) {
      const isbnCheck = validateIsbn(isbn13);
      if (!isbnCheck.valid) {
        return NextResponse.json({ success: false, error: `Invalid ISBN-13: ${isbnCheck.error}` }, { status: 400 });
      }
    }

    const updated = await withTenantContext(schoolId, async () => {
      const existing = await prisma.libraryBook.findFirst({
        where: { id: bookId, schoolId },
      });
      if (!existing) throw new Error('Book not found');

      return prisma.libraryBook.update({
        where: { id: bookId },
        data: parsed.data,
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_DELETE' });
    const { bookId } = await params;

    await withTenantContext(schoolId, async () => {
      const book = await prisma.libraryBook.findFirst({
        where: { id: bookId, schoolId },
        include: {
          _count: {
            select: { copies: true, reservations: true },
          },
        },
      });

      if (!book) throw new Error('Book not found');

      if (book._count.copies > 0) {
        throw new Error(`Cannot delete book with ${book._count.copies} registered copy/copies. Remove or withdraw copies first.`);
      }

      if (book._count.reservations > 0) {
        throw new Error(`Cannot delete book with active reservations.`);
      }

      await prisma.libraryBook.delete({
        where: { id: bookId },
      });
    });

    return NextResponse.json({ success: true, message: 'Book deleted successfully' });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
