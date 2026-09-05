import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { calculatePayrollRecord, ComponentInput, SalaryAdvanceRecoveryInput } from '@/lib/payroll/calculator';
import { generatePayslipNumber } from '@/lib/payroll/payslip';
import { PayrollGenerateSchema } from '@/lib/validation/payroll';
import {
  AdvanceStatus,
  AttendanceStatus,
  AuditAction,
  EmployeeStatus,
  LeaveRequestStatus,
  PayrollPeriodStatus,
  PayrollRecordStatus,
  Prisma,
} from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'PAYROLL_CALCULATE' });

    const body = await request.json();
    const parseResult = PayrollGenerateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Validation Error', details: parseResult.error.format() }, { status: 400 });
    }

    const { periodId, campusId, departmentId, employeeIds } = parseResult.data;

    // 1. Fetch period and verify state
    const period = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, schoolId },
    });

    if (!period) {
      return NextResponse.json({ error: 'Payroll period not found.' }, { status: 404 });
    }

    if (
      period.status === PayrollPeriodStatus.FINALIZED ||
      period.status === PayrollPeriodStatus.PAID ||
      period.status === PayrollPeriodStatus.CLOSED
    ) {
      return NextResponse.json(
        { error: `Cannot regenerate payroll for period with finalized status '${period.status}'.` },
        { status: 400 }
      );
    }

    // 2. Query eligible active employees
    const empWhere: any = {
      schoolId,
      status: EmployeeStatus.ACTIVE,
    };
    if (campusId) empWhere.campusId = campusId;
    if (departmentId) empWhere.departmentId = departmentId;
    if (employeeIds && employeeIds.length > 0) empWhere.id = { in: employeeIds };

    const employees = await prisma.employee.findMany({
      where: empWhere,
      include: {
        department: true,
        designation: true,
        campus: true,
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({ error: 'No eligible active employees found for this selection.' }, { status: 400 });
    }

    // 3. Execute generation in tenant-isolated transaction
    const generationResult = await withTenantContext(schoolId, async (tx) => {
      // Row lock the period to prevent concurrent duplicate generation runs
      await tx.$executeRaw`SELECT id FROM payroll_periods WHERE id = ${periodId}::uuid FOR UPDATE`;

      let periodGrossTotal = new Prisma.Decimal(0);
      let periodDeductionsTotal = new Prisma.Decimal(0);
      let periodNetTotal = new Prisma.Decimal(0);
      const generatedRecords = [];

      for (const emp of employees) {
        // Resolve active salary assignment effective for period
        const assignment = await tx.employeeSalaryAssignment.findFirst({
          where: {
            schoolId,
            employeeId: emp.id,
            status: 'ACTIVE',
            effectiveFrom: { lte: period.endDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }],
          },
          include: {
            items: {
              include: { component: true },
            },
          },
          orderBy: { effectiveFrom: 'desc' },
        });

        if (!assignment) {
          // Employee has no effective salary assignment; skip
          continue;
        }

        // Attendance stats for period
        const attendances = await tx.employeeAttendance.findMany({
          where: {
            schoolId,
            employeeId: emp.id,
            date: { gte: period.startDate, lte: period.endDate },
          },
        });

        let presentDays = 0;
        let absentDays = 0;
        let lateDays = 0;
        let paidLeaveDays = 0;

        for (const att of attendances) {
          if (att.status === AttendanceStatus.PRESENT) presentDays++;
          else if (att.status === AttendanceStatus.ABSENT) absentDays++;
          else if (att.status === AttendanceStatus.LATE) lateDays++;
          else if (att.status === AttendanceStatus.LEAVE) paidLeaveDays++;
        }

        // Unpaid leave requests in period
        const unpaidLeaves = await tx.leaveRequest.findMany({
          where: {
            schoolId,
            employeeId: emp.id,
            status: LeaveRequestStatus.APPROVED,
            leaveType: { isPaid: false },
            startDate: { lte: period.endDate },
            endDate: { gte: period.startDate },
          },
        });

        const unpaidLeaveDays = unpaidLeaves.reduce((acc, l) => acc + Number(l.totalDays), 0);

        // Check active advance recovery
        const activeAdvance = await tx.salaryAdvance.findFirst({
          where: {
            schoolId,
            employeeId: emp.id,
            status: AdvanceStatus.APPROVED,
            balanceRemaining: { gt: 0 },
          },
          orderBy: { createdAt: 'asc' },
        });

        const advancesInput: SalaryAdvanceRecoveryInput[] = activeAdvance
          ? [
              {
                advanceId: activeAdvance.id,
                advanceNumber: activeAdvance.advanceNumber,
                monthlyDeduction: Number(activeAdvance.monthlyDeduction),
                balanceRemaining: Number(activeAdvance.balanceRemaining),
              },
            ]
          : [];

        // Map components
        const components: ComponentInput[] = assignment.items.map((item) => ({
          code: item.component.code,
          nameEn: item.component.nameEn,
          nameBn: item.component.nameBn,
          type: item.component.type,
          calculationMethod: item.component.calculationMethod,
          amount: Number(item.amount),
          percentageValue: item.component.percentageValue ? Number(item.component.percentageValue) : null,
          formulaExpression: item.component.formulaExpression,
          isTaxable: item.component.isTaxable,
        }));

        // Authoritative server-side calculation
        const calc = calculatePayrollRecord({
          basicSalary: Number(assignment.baseSalary),
          components,
          attendance: {
            totalWorkingDays: 30,
            presentDays,
            absentDays,
            lateDays,
            leaveDays: paidLeaveDays,
            unpaidLeaveDays,
            overtimeHours: 0,
          },
          advances: advancesInput,
        });

        // Delete any existing draft record for this employee and period (safe regeneration)
        const existingDraft = await tx.payrollRecord.findFirst({
          where: {
            schoolId,
            periodId: period.id,
            employeeId: emp.id,
          },
        });

        if (existingDraft) {
          if (existingDraft.status === PayrollRecordStatus.FINALIZED || existingDraft.status === PayrollRecordStatus.PAID) {
            // Immutable: skip finalized record
            continue;
          }
          await tx.payrollItem.deleteMany({ where: { payrollRecordId: existingDraft.id } });
          await tx.payrollRecord.delete({ where: { id: existingDraft.id } });
        }

        const payslipNumber = generatePayslipNumber(new Date());

        const record = await tx.payrollRecord.create({
          data: {
            schoolId,
            periodId: period.id,
            employeeId: emp.id,
            salaryAssignmentId: assignment.id,
            payslipNumber,
            campusId: emp.campusId,
            departmentId: emp.departmentId,
            designationId: emp.designationId,
            employmentType: emp.employmentType,
            basicSalary: calc.basicSalary,
            grossEarnings: calc.grossEarnings,
            totalDeductions: calc.totalDeductions,
            advanceRecoveryAmount: calc.advanceRecoveryAmount,
            netSalary: calc.netSalary,
            paidAmount: new Prisma.Decimal(0),
            dueSalary: calc.netSalary,
            totalWorkingDays: 30,
            presentDays,
            absentDays,
            lateDays,
            leaveDays: paidLeaveDays,
            unpaidLeaveDays,
            overtimeHours: new Prisma.Decimal(0),
            overtimeAmount: new Prisma.Decimal(0),
            status: PayrollRecordStatus.DRAFT,
            calculationSnapshot: calc.snapshot as any,
            generatedById: context.userId,
          },
        });

        // Create line items
        for (const item of [...calc.earningsItems, ...calc.deductionsItems]) {
          await tx.payrollItem.create({
            data: {
              schoolId,
              payrollRecordId: record.id,
              code: item.code,
              nameEn: item.nameEn,
              nameBn: item.nameBn,
              type: item.type,
              amount: item.amount,
              isTaxable: item.isTaxable,
            },
          });
        }

        periodGrossTotal = periodGrossTotal.plus(calc.grossEarnings);
        periodDeductionsTotal = periodDeductionsTotal.plus(calc.totalDeductions);
        periodNetTotal = periodNetTotal.plus(calc.netSalary);
        generatedRecords.push(record);
      }

      // Update period totals
      const updatedPeriod = await tx.payrollPeriod.update({
        where: { id: period.id },
        data: {
          totalGross: periodGrossTotal,
          totalDeductions: periodDeductionsTotal,
          totalNet: periodNetTotal,
          employeeCount: generatedRecords.length,
        },
      });

      return { updatedPeriod, recordCount: generatedRecords.length };
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName,
      action: AuditAction.INSERT,
      entity: 'PayrollPeriod',
      entityId: period.id,
      changeSummary: `Generated payroll for period '${period.nameEn}' with ${generationResult.recordCount} employee records`,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully calculated payroll for ${generationResult.recordCount} employees.`,
      data: generationResult,
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
