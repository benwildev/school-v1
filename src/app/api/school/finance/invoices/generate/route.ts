import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { InvoiceGenerateBatchSchema } from '@/lib/validation/finance';
import { generateInvoiceNumber, calculateEffectiveDiscount } from '@/lib/finance/invoice';
import { enqueueFeeNoticeNotifications } from '@/lib/communication/event-triggers';
import { AuditAction } from '@prisma/client';

/**
 * POST /api/school/finance/invoices/generate
 * Bulk generates student fee invoices for a class/section roster with discount resolution & duplicate prevention
 * Required Permission: FEES_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'FEES_CREATE',
    });

    const body = await request.json();
    const parseResult = InvoiceGenerateBatchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Verify session and class
    const [session, classObj, feeType] = await Promise.all([
      prisma.academicSession.findFirst({
        where: { id: data.academicSessionId, schoolId },
      }),
      prisma.class.findFirst({
        where: { id: data.classId, schoolId },
      }),
      prisma.feeType.findFirst({
        where: { id: data.feeTypeId, schoolId },
      }),
    ]);

    if (!session) {
      return NextResponse.json({ error: 'Academic session not found' }, { status: 404 });
    }
    if (!classObj) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (!feeType) {
      return NextResponse.json({ error: 'Fee type not found' }, { status: 404 });
    }

    // 1. Fetch active enrollments for this class/section
    const enrollmentWhere: any = {
      schoolId,
      academicSessionId: data.academicSessionId,
      classId: data.classId,
      status: 'ACTIVE',
    };
    if (data.sectionId) {
      enrollmentWhere.sectionId = data.sectionId;
    }

    const enrollments = await prisma.enrollment.findMany({
      where: enrollmentWhere,
      select: {
        id: true,
        studentId: true,
      },
    });

    if (enrollments.length === 0) {
      return NextResponse.json(
        { error: 'No active enrollments found for the selected class/section' },
        { status: 404 }
      );
    }

    // 2. Fetch existing invoices for this period to prevent duplicate charges
    const enrollmentIds = enrollments.map((e) => e.id);
    const existingInvoices = await prisma.studentFee.findMany({
      where: {
        schoolId,
        feeTypeId: data.feeTypeId,
        billingPeriodKey: data.billingPeriodKey,
        enrollmentId: { in: enrollmentIds },
      },
      select: { enrollmentId: true },
    });

    const existingEnrollmentSet = new Set(existingInvoices.map((i) => i.enrollmentId));

    // 3. Fetch active discounts for these students
    const studentIds = enrollments.map((e) => e.studentId);
    const discounts = await prisma.studentDiscount.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status: 'ACTIVE',
        OR: [
          { feeTypeId: data.feeTypeId },
          { feeTypeId: null },
        ],
      },
    });

    const discountMap = new Map<string, typeof discounts[0]>();
    for (const d of discounts) {
      // Prioritize fee-specific discount over general
      const current = discountMap.get(d.studentId);
      if (!current || (d.feeTypeId && !current.feeTypeId)) {
        discountMap.set(d.studentId, d);
      }
    }

    // 4. Build invoice generation payload
    const invoicesToCreate: any[] = [];
    const skippedEnrollments: string[] = [];

    for (const enroll of enrollments) {
      if (existingEnrollmentSet.has(enroll.id)) {
        skippedEnrollments.push(enroll.id);
        continue;
      }

      const activeDiscount = discountMap.get(enroll.studentId);
      let discountAmount = 0;
      let netAmount = data.baseAmount + (data.fineAmount || 0);

      if (activeDiscount) {
        const discResult = calculateEffectiveDiscount({
          baseAmount: data.baseAmount,
          discountType: activeDiscount.discountType,
          discountValue: activeDiscount.discountValue,
          fineAmount: data.fineAmount || 0,
        });
        discountAmount = discResult.discountAmount.toNumber();
        netAmount = discResult.netAmount.toNumber();
      }

      invoicesToCreate.push({
        schoolId,
        invoiceNumber: generateInvoiceNumber(),
        studentId: enroll.studentId,
        enrollmentId: enroll.id,
        feeStructureId: data.feeStructureId || null,
        feeTypeId: data.feeTypeId,
        billingPeriodType: data.billingPeriodType,
        billingPeriodKey: data.billingPeriodKey,
        periodStartDate: new Date(data.periodStartDate),
        periodEndDate: new Date(data.periodEndDate),
        dueDate: new Date(data.dueDate),
        baseAmount: data.baseAmount,
        discountAmount,
        fineAmount: data.fineAmount || 0,
        netAmount,
        paidAmount: 0,
        dueAmount: netAmount,
        status: 'UNPAID' as const,
      });
    }

    if (invoicesToCreate.length === 0) {
      return NextResponse.json(
        {
          error: `All ${enrollments.length} students already have invoices for billing period ${data.billingPeriodKey}.`,
          skippedCount: skippedEnrollments.length,
        },
        { status: 409 }
      );
    }

    // 5. Persist invoices atomically
    const createdInvoices = await withTenantContext(schoolId, async (tx) => {
      const results = [];
      for (const inv of invoicesToCreate) {
        const created = await tx.studentFee.create({
          data: inv,
        });
        results.push(created);
      }
      return results;
    });

    // Enqueue fee notices asynchronously under school tenant scoping
    if (createdInvoices.length > 0) {
      enqueueFeeNoticeNotifications(
        schoolId,
        createdInvoices.map((inv) => ({
          id: inv.id,
          studentId: inv.studentId,
          invoiceNumber: inv.invoiceNumber,
          netAmount: inv.netAmount,
          dueDate: inv.dueDate,
        }))
      ).catch((err) => {
        console.error('Failed to enqueue fee notice notifications:', err);
      });
    }

    // 6. Forensic audit log
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: 'ADMIN',
      action: AuditAction.INSERT,
      entity: 'StudentFee',
      entityId: `${data.classId}_${data.billingPeriodKey}`,
      afterState: {
        classId: data.classId,
        feeTypeId: data.feeTypeId,
        billingPeriodKey: data.billingPeriodKey,
        generatedCount: createdInvoices.length,
        skippedCount: skippedEnrollments.length,
      },
      changeSummary: `Generated ${createdInvoices.length} invoices for ${feeType.nameEn} in ${classObj.nameEn} (${data.billingPeriodKey})`,
    });

    return NextResponse.json(
      {
        success: true,
        generatedCount: createdInvoices.length,
        skippedCount: skippedEnrollments.length,
        data: createdInvoices,
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
