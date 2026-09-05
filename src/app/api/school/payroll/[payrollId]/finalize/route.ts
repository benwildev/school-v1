import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AdvanceStatus, AuditAction, PayrollPeriodStatus, PayrollRecordStatus, Prisma } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payrollId: string }> }
) {
  try {
    const { payrollId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'PAYROLL_FINALIZE' });

    const [record, period] = await Promise.all([
      prisma.payrollRecord.findFirst({
        where: { id: payrollId, schoolId },
        include: { period: true, employee: true },
      }),
      prisma.payrollPeriod.findFirst({
        where: { id: payrollId, schoolId },
      }),
    ]);

    if (!record && !period) {
      return NextResponse.json({ error: 'Payroll record or period not found.' }, { status: 404 });
    }

    const finalizedResult = await withTenantContext(schoolId, async (tx) => {
      if (period) {
        await tx.$executeRaw`SELECT id FROM payroll_periods WHERE id = ${period.id}::uuid FOR UPDATE`;

        if (period.status === PayrollPeriodStatus.FINALIZED || period.status === PayrollPeriodStatus.PAID) {
          throw new Error('Payroll period is already finalized.');
        }

        const records = await tx.payrollRecord.findMany({
          where: { periodId: period.id, schoolId, status: PayrollRecordStatus.DRAFT },
        });

        for (const rec of records) {
          if (rec.advanceRecoveryAmount && Number(rec.advanceRecoveryAmount) > 0) {
            const activeAdvance = await tx.salaryAdvance.findFirst({
              where: {
                schoolId,
                employeeId: rec.employeeId,
                status: AdvanceStatus.APPROVED,
                balanceRemaining: { gt: 0 },
              },
              orderBy: { createdAt: 'asc' },
            });

            if (activeAdvance) {
              const deduction = new Prisma.Decimal(rec.advanceRecoveryAmount);
              const newBalance = new Prisma.Decimal(activeAdvance.balanceRemaining).minus(deduction);
              const newRecovered = new Prisma.Decimal(activeAdvance.totalRecovered).plus(deduction);

              await tx.advanceRepaymentLog.create({
                data: {
                  schoolId,
                  advanceId: activeAdvance.id,
                  payrollRecordId: rec.id,
                  amount: deduction,
                  repaymentDate: new Date(),
                  balanceAfter: newBalance,
                  notes: `Payroll recovery for period ${period.nameEn}`,
                },
              });

              await tx.salaryAdvance.update({
                where: { id: activeAdvance.id },
                data: {
                  totalRecovered: newRecovered,
                  balanceRemaining: newBalance,
                  status: newBalance.lessThanOrEqualTo(0) ? AdvanceStatus.REPAID : activeAdvance.status,
                },
              });
            }
          }

          await tx.payrollRecord.update({
            where: { id: rec.id },
            data: {
              status: PayrollRecordStatus.FINALIZED,
              finalizedAt: new Date(),
              finalizedById: context.userId,
            },
          });
        }

        const updatedPeriod = await tx.payrollPeriod.update({
          where: { id: period.id },
          data: {
            status: PayrollPeriodStatus.FINALIZED,
            finalizedAt: new Date(),
            finalizedById: context.userId,
          },
        });

        return { type: 'PERIOD', data: updatedPeriod, count: records.length };
      } else {
        await tx.$executeRaw`SELECT id FROM payroll_records WHERE id = ${record!.id}::uuid FOR UPDATE`;

        if (record!.status === PayrollRecordStatus.FINALIZED || record!.status === PayrollRecordStatus.PAID) {
          throw new Error('Payroll record is already finalized and immutable.');
        }

        if (record!.advanceRecoveryAmount && Number(record!.advanceRecoveryAmount) > 0) {
          const activeAdvance = await tx.salaryAdvance.findFirst({
            where: {
              schoolId,
              employeeId: record!.employeeId,
              status: AdvanceStatus.APPROVED,
              balanceRemaining: { gt: 0 },
            },
            orderBy: { createdAt: 'asc' },
          });

          if (activeAdvance) {
            const deduction = new Prisma.Decimal(record!.advanceRecoveryAmount);
            const newBalance = new Prisma.Decimal(activeAdvance.balanceRemaining).minus(deduction);
            const newRecovered = new Prisma.Decimal(activeAdvance.totalRecovered).plus(deduction);

            await tx.advanceRepaymentLog.create({
              data: {
                schoolId,
                advanceId: activeAdvance.id,
                payrollRecordId: record!.id,
                amount: deduction,
                repaymentDate: new Date(),
                balanceAfter: newBalance,
                notes: `Payroll recovery for period ${record!.period.nameEn}`,
              },
            });

            await tx.salaryAdvance.update({
              where: { id: activeAdvance.id },
              data: {
                totalRecovered: newRecovered,
                balanceRemaining: newBalance,
                status: newBalance.lessThanOrEqualTo(0) ? AdvanceStatus.REPAID : activeAdvance.status,
              },
            });
          }
        }

        const updatedRecord = await tx.payrollRecord.update({
          where: { id: record!.id },
          data: {
            status: PayrollRecordStatus.FINALIZED,
            finalizedAt: new Date(),
            finalizedById: context.userId,
          },
        });

        return { type: 'RECORD', data: updatedRecord, count: 1 };
      }
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.APPROVE,
      entity: finalizedResult.type === 'PERIOD' ? 'PayrollPeriod' : 'PayrollRecord',
      entityId: payrollId,
      changeSummary: `Finalized payroll (${finalizedResult.type}) containing ${finalizedResult.count} records. Records are now immutable.`,
    });

    return NextResponse.json({
      success: true,
      message: 'Payroll successfully finalized and locked permanently.',
      data: finalizedResult.data,
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 400 });
  }
}
