import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateReservationSchema } from '@/lib/validation/library';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get('bookId') || undefined;
    const status = searchParams.get('status') || undefined;
    const borrowerType = searchParams.get('borrowerType') || undefined;
    const studentId = searchParams.get('studentId') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;

    const reservations = await withTenantContext(schoolId, async () => {
      const whereClause: any = { schoolId };
      if (bookId) whereClause.bookId = bookId;
      if (status) whereClause.status = status;
      if (borrowerType) whereClause.borrowerType = borrowerType;
      if (studentId) whereClause.studentId = studentId;
      if (employeeId) whereClause.employeeId = employeeId;

      return prisma.libraryReservation.findMany({
        where: whereClause,
        include: {
          book: {
            select: { id: true, titleEn: true, titleBn: true, isbn10: true, isbn13: true },
          },
          student: { select: { id: true, studentCode: true, firstNameEn: true, lastNameEn: true } },
          employee: { select: { id: true, employeeCode: true, firstNameEn: true, lastNameEn: true } },
        },
        orderBy: { reservationDate: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: reservations });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_RESERVE' });

    const body = await request.json();
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { bookId, borrowerType, studentId, employeeId, notes } = parsed.data;

    const reservation = await withTenantContext(schoolId, async () => {
      return prisma.$transaction(async (tx) => {
        let settings = await tx.librarySetting.findUnique({ where: { schoolId } });
        if (!settings) {
          settings = await tx.librarySetting.create({ data: { schoolId } });
        }

        if (borrowerType === 'STUDENT' && !settings.allowStudentReservations) {
          throw new Error('Student reservations are currently disabled by library policy.');
        }
        if (borrowerType === 'EMPLOYEE' && !settings.allowEmployeeReservations) {
          throw new Error('Employee reservations are currently disabled by library policy.');
        }

        const book = await tx.libraryBook.findFirst({
          where: { id: bookId, schoolId },
        });
        if (!book) {
          throw new Error('Book not found in this school');
        }

        // Check if borrower already has an active reservation for this book
        const existing = await tx.libraryReservation.findFirst({
          where: {
            schoolId,
            bookId,
            status: 'PENDING',
            ...(borrowerType === 'STUDENT' ? { studentId } : { employeeId }),
          },
        });
        if (existing) {
          throw new Error('Borrower already has a pending reservation for this book.');
        }

        const reservationDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + settings.reservationValidityDays);

        return tx.libraryReservation.create({
          data: {
            schoolId,
            bookId,
            borrowerType,
            studentId: borrowerType === 'STUDENT' ? studentId : null,
            employeeId: borrowerType === 'EMPLOYEE' ? employeeId : null,
            reservationDate,
            expiryDate,
            status: 'PENDING',
            notes: notes || null,
          },
          include: {
            book: true,
            student: true,
            employee: true,
          },
        });
      });
    });

    return NextResponse.json({ success: true, data: reservation }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_RESERVE' });

    const body = await request.json();
    const { reservationId, status } = body;
    if (!reservationId || !['CANCELLED', 'FULFILLED', 'EXPIRED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Valid reservationId and status (CANCELLED, FULFILLED, EXPIRED) required' },
        { status: 400 }
      );
    }

    const updated = await withTenantContext(schoolId, async () => {
      const reservation = await prisma.libraryReservation.findFirst({
        where: { id: reservationId, schoolId },
      });
      if (!reservation) throw new Error('Reservation not found');

      return prisma.libraryReservation.update({
        where: { id: reservationId },
        data: {
          status,
          fulfilledDate: status === 'FULFILLED' ? new Date() : reservation.fulfilledDate,
        },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
