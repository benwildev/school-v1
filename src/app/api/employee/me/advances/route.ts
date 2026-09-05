import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requireAuth } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { generateAdvanceNumber } from '@/lib/payroll/payslip';
import { AdvanceStatus, AuditAction } from '@prisma/client';
import { z } from 'zod';

const SelfAdvanceRequestSchema = z.object({
  amount: z.number().positive(),
  monthlyDeduction: z.number().positive(),
  purpose: z.string().min(2).max(255),
});

export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    const employee = await prisma.employee.findFirst({
      where: {
        userId: context.userId,
        ...(context.activeSchoolId ? { schoolId: context.activeSchoolId } : {}),
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'No employee record linked to current user session.' }, { status: 404 });
    }

    const advances = await prisma.salaryAdvance.findMany({
      where: {
        schoolId: employee.schoolId,
        employeeId: employee.id,
      },
      include: {
        repaymentLogs: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: advances });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth(request);

    const employee = await prisma.employee.findFirst({
      where: {
        userId: context.userId,
        ...(context.activeSchoolId ? { schoolId: context.activeSchoolId } : {}),
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'No employee record linked to current user session.' }, { status: 404 });
    }

    const body = await request.json();
    const parseResult = SelfAdvanceRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { amount, monthlyDeduction, purpose } = parseResult.data;

    if (monthlyDeduction > amount) {
      return NextResponse.json({ error: 'Monthly deduction cannot be greater than total advance amount.' }, { status: 400 });
    }

    const advance = await withTenantContext(employee.schoolId, async (tx) => {
      const advanceNumber = generateAdvanceNumber(new Date());

      return tx.salaryAdvance.create({
        data: {
          schoolId: employee.schoolId,
          employeeId: employee.id,
          advanceNumber,
          requestedAmount: amount,
          approvedAmount: amount,
          monthlyDeduction,
          totalRecovered: 0,
          balanceRemaining: amount,
          reason: purpose,
          status: AdvanceStatus.PENDING,
        },
      });
    });

    await logAuditEvent({
      schoolId: employee.schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'SalaryAdvance',
      entityId: advance.id,
      afterState: advance as any,
      changeSummary: `Employee self-service advance requested for ৳${amount}`,
    });

    return NextResponse.json({ success: true, data: advance }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 400 });
  }
}
