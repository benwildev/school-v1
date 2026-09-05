import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { PaymentRecordSchema } from '@/lib/validation/finance';
import { generatePaymentNumber } from '@/lib/finance/invoice';
import { processPaymentAllocation } from '@/lib/finance/allocation';
import { AuditAction } from '@prisma/client';

/**
 * GET /api/school/finance/payments
 * List payment records with filters
 * Required Permission: PAYMENTS_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'PAYMENTS_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const paymentMethod = searchParams.get('paymentMethod') as any;
    const status = searchParams.get('status') as any;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where: any = { schoolId };
    if (studentId) where.studentId = studentId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              studentCode: true,
              firstNameEn: true,
              lastNameEn: true,
              fullNameEn: true,
              fullNameBn: true,
            },
          },
          allocations: {
            include: {
              studentFee: {
                select: {
                  invoiceNumber: true,
                  billingPeriodKey: true,
                  netAmount: true,
                  dueAmount: true,
                },
              },
            },
          },
          receipt: true,
          receivedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.payment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: payments,
      pagination: {
        total: totalCount,
        limit,
        offset,
      },
    });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/school/finance/payments
 * Collect / record a fee payment, allocate across invoices (or auto-allocate),
 * route excess to advance credit, and generate receipt.
 * Required Permission: PAYMENTS_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'PAYMENTS_CREATE',
    });

    const body = await request.json();
    const parseResult = PaymentRecordSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Verify student and enrollment belong to the school
    const [student, enrollment] = await Promise.all([
      prisma.student.findFirst({
        where: { id: data.studentId, schoolId },
      }),
      prisma.enrollment.findFirst({
        where: { id: data.enrollmentId, schoolId, studentId: data.studentId },
      }),
    ]);

    if (!student) {
      return NextResponse.json({ error: 'Student not found in this school' }, { status: 404 });
    }
    if (!enrollment) {
      return NextResponse.json(
        { error: 'Enrollment record not found for this student in this school' },
        { status: 404 }
      );
    }

    const paymentNumber = generatePaymentNumber();
    const paymentDate = data.paymentDate ? new Date(data.paymentDate) : new Date();

    // Execute payment and allocation atomically
    const result = await withTenantContext(schoolId, async (tx) => {
      // 1. Create base payment record
      const payment = await tx.payment.create({
        data: {
          schoolId,
          paymentNumber,
          studentId: data.studentId,
          enrollmentId: data.enrollmentId,
          totalAmount: data.totalAmount,
          allocatedAmount: 0,
          advanceCreditAmount: 0,
          paymentMethod: data.paymentMethod,
          transactionId: data.transactionId || null,
          bankName: data.bankName || null,
          bankBranch: data.bankBranch || null,
          chequeNumber: data.chequeNumber || null,
          chequeDate: data.chequeDate ? new Date(data.chequeDate) : null,
          paymentDate,
          status: 'SUCCESS',
          notes: data.notes || null,
          receivedById: context.userId,
        },
      });

      // 2. Process allocation across invoices & advance credit wallet
      const allocResult = await processPaymentAllocation({
        tx,
        schoolId,
        studentId: data.studentId,
        paymentId: payment.id,
        paymentNumber,
        totalAmount: data.totalAmount,
        receivedById: context.userId,
        allocations: data.allocations,
        autoAllocateOldest: data.autoAllocateOldest !== false,
      });

      return {
        paymentId: payment.id,
        paymentNumber,
        ...allocResult,
      };
    });

    // Forensic audit log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: 'STAFF',
      action: AuditAction.INSERT,
      entity: 'Payment',
      entityId: result.paymentId,
      afterState: {
        paymentNumber: result.paymentNumber,
        totalAmount: data.totalAmount,
        allocatedAmount: result.allocatedAmount.toNumber(),
        advanceCreditAmount: result.advanceCreditAmount.toNumber(),
        receiptNumber: result.receiptNumber,
      },
      changeSummary: `Collected payment ${result.paymentNumber} of ${data.totalAmount} BDT for student ${student.studentCode}. Receipt: ${result.receiptNumber}`,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
