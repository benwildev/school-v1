import { prisma } from '@/lib/db';

export interface TransportFeeGenerationInput {
  schoolId: string;
  assignmentId: string;
  billingPeriod: string; // e.g. "2026-01"
  dueDate: Date | string;
  generatedById: string;
}

/**
 * Ensures that a default 'TRANSPORT_FEE' fee type exists for the school.
 */
export async function getOrCreateTransportFeeType(schoolId: string, tx: any = prisma) {
  let feeType = await tx.feeType.findFirst({
    where: {
      schoolId,
      code: 'TRANSPORT_FEE',
    },
  });

  if (!feeType) {
    feeType = await tx.feeType.create({
      data: {
        schoolId,
        code: 'TRANSPORT_FEE',
        nameEn: 'Transport Fee',
        nameBn: 'পরিবহন ফি',
        description: 'Monthly student bus and van transport service charge',
        isRecurring: true,
        isRefundable: false,
        status: 'ACTIVE',
      },
    });
  }

  return feeType;
}

/**
 * Links a student transport assignment with a FeeStructure and computes net fee taking
 * existing student discounts into account.
 */
export async function calculateStudentTransportNetFee(params: {
  schoolId: string;
  studentId: string;
  baseAmount: number;
  tx?: any;
}) {
  const { schoolId, studentId, baseAmount, tx = prisma } = params;

  // Check for active student discounts authorized under Phase 6
  const activeDiscount = await tx.studentDiscount.findFirst({
    where: {
      schoolId,
      studentId,
      status: 'ACTIVE',
    },
  });

  let discountAmount = 0;
  if (activeDiscount) {
    if (activeDiscount.discountType === 'FIXED') {
      discountAmount = Math.min(baseAmount, Number(activeDiscount.value));
    } else if (activeDiscount.discountType === 'PERCENTAGE') {
      discountAmount = (baseAmount * Number(activeDiscount.value)) / 100;
      discountAmount = Math.min(baseAmount, discountAmount);
    }
  }

  const netAmount = Math.max(0, baseAmount - discountAmount);

  return {
    baseAmount,
    discountAmount,
    netAmount,
    discountId: activeDiscount?.id || null,
  };
}
