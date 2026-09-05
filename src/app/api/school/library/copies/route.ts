import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateLibraryBookCopySchema } from '@/lib/validation/library';
import { generateBarcode, generateAccessionNumber } from '@/lib/library/book-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get('bookId') || undefined;
    const status = searchParams.get('status') || undefined;
    const campusId = searchParams.get('campusId') || undefined;
    const barcode = searchParams.get('barcode')?.trim() || undefined;

    const copies = await withTenantContext(schoolId, async () => {
      const whereClause: any = { schoolId };
      if (bookId) whereClause.bookId = bookId;
      if (status) whereClause.status = status;
      if (campusId) whereClause.campusId = campusId;
      if (barcode) whereClause.barcode = barcode;

      return prisma.libraryBookCopy.findMany({
        where: whereClause,
        include: {
          book: {
            select: { id: true, titleEn: true, titleBn: true, isbn10: true, isbn13: true },
          },
          campus: {
            select: { id: true, nameEn: true, nameBn: true },
          },
          loans: {
            where: { status: { in: ['ISSUED', 'OVERDUE'] } },
            select: {
              id: true,
              borrowerType: true,
              dueDate: true,
              student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
              employee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
            },
          },
        },
        orderBy: { accessionNumber: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: copies });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_MANAGE_CATALOG' });

    const body = await request.json();
    const parsed = CreateLibraryBookCopySchema.safeParse({
      ...body,
      barcode: body.barcode || generateBarcode(),
      accessionNumber: body.accessionNumber || generateAccessionNumber(),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      bookId,
      campusId,
      accessionNumber,
      barcode,
      shelfRack,
      acquisitionDate,
      acquisitionCost,
      condition,
      notes,
    } = parsed.data;

    const copy = await withTenantContext(schoolId, async () => {
      // Check that the book belongs to the school
      const book = await prisma.libraryBook.findFirst({
        where: { id: bookId, schoolId },
      });
      if (!book) throw new Error('Book not found in this school');

      // Check unique accessionNumber in school
      const existingAcc = await prisma.libraryBookCopy.findFirst({
        where: { schoolId, accessionNumber },
      });
      if (existingAcc) {
        throw new Error(`Accession number "${accessionNumber}" is already in use.`);
      }

      // Check unique barcode in school
      const existingBc = await prisma.libraryBookCopy.findFirst({
        where: { schoolId, barcode },
      });
      if (existingBc) {
        throw new Error(`Barcode "${barcode}" is already in use.`);
      }

      return prisma.libraryBookCopy.create({
        data: {
          schoolId,
          bookId,
          campusId: campusId || null,
          accessionNumber,
          barcode,
          shelfRack: shelfRack || null,
          acquisitionDate: acquisitionDate ? new Date(acquisitionDate) : new Date(),
          acquisitionCost: acquisitionCost || 0,
          condition: condition || 'NEW',
          status: 'AVAILABLE',
          notes: notes || null,
        },
        include: {
          book: true,
          campus: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: copy }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
