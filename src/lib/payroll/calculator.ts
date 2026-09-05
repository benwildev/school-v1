import { Decimal } from '@prisma/client/runtime/library';

export interface ComponentInput {
  code: string;
  nameEn: string;
  nameBn: string;
  type: 'EARNING' | 'DEDUCTION';
  calculationMethod: 'FIXED' | 'PERCENT_OF_BASIC' | 'PERCENT_OF_GROSS' | 'FORMULA';
  amount: number | Decimal;
  percentageValue?: number | Decimal | null;
  formulaExpression?: string | null;
  isTaxable?: boolean;
}

export interface AttendanceMetrics {
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  leaveDays: number;
  unpaidLeaveDays: number;
  overtimeHours: number;
  overtimeRatePerHour?: number;
}

export interface SalaryAdvanceRecoveryInput {
  advanceId: string;
  advanceNumber: string;
  monthlyDeduction: number | Decimal;
  balanceRemaining: number | Decimal;
}

export interface PayrollCalculationResult {
  basicSalary: Decimal;
  grossEarnings: Decimal;
  totalDeductions: Decimal;
  advanceRecoveryAmount: Decimal;
  netSalary: Decimal;
  earningsItems: Array<{
    code: string;
    nameEn: string;
    nameBn: string;
    amount: Decimal;
    type: 'EARNING';
    isTaxable: boolean;
  }>;
  deductionsItems: Array<{
    code: string;
    nameEn: string;
    nameBn: string;
    amount: Decimal;
    type: 'DEDUCTION';
    isTaxable: boolean;
  }>;
  snapshot: {
    calculatedAt: string;
    basicSalary: number;
    grossEarnings: number;
    totalDeductions: number;
    advanceRecovery: number;
    netSalary: number;
    attendance: AttendanceMetrics;
    components: Array<{
      code: string;
      nameEn: string;
      nameBn: string;
      type: 'EARNING' | 'DEDUCTION';
      amount: number;
    }>;
    advanceRecoveries: Array<{
      advanceId: string;
      advanceNumber: string;
      recoveredAmount: number;
      balanceRemainingAfter: number;
    }>;
  };
}

/**
 * Standard rounding to 2 decimal places using ROUND_HALF_UP.
 */
export function roundToCurrency(val: Decimal): Decimal {
  return new Decimal(val.toFixed(2, Decimal.ROUND_HALF_UP));
}

/**
 * Controlled formula evaluation without arbitrary JavaScript execution.
 * Only supports standard arithmetic tokens: +, -, *, / with variable replacement.
 */
function evaluateControlledFormula(
  expression: string,
  variables: Record<string, Decimal>
): Decimal {
  // Replace recognized variable tokens
  let parsed = expression;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    parsed = parsed.replace(regex, val.toString());
  }

  // Strictly sanitize: only numbers, decimal points, spaces, and basic math operators allowed
  if (!/^[\d\s+\-*/().]+$/.test(parsed)) {
    throw new Error(`Invalid characters in formula expression: "${expression}"`);
  }

  try {
    // Safe evaluation using Function with strict math sandbox
    const result = new Function(`"use strict"; return (${parsed});`)();
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error(`Formula evaluation resulted in non-numeric value: ${result}`);
    }
    return new Decimal(result);
  } catch (err: any) {
    throw new Error(`Failed to evaluate formula expression "${expression}": ${err.message}`);
  }
}

/**
 * Authoritative Server-Side Payroll Calculation Engine
 */
export function calculatePayrollRecord(params: {
  basicSalary: number | Decimal;
  components: ComponentInput[];
  attendance: AttendanceMetrics;
  advances?: SalaryAdvanceRecoveryInput[];
  oneTimeBonuses?: Array<{ code: string; nameEn: string; nameBn: string; amount: number | Decimal }>;
  oneTimeDeductions?: Array<{ code: string; nameEn: string; nameBn: string; amount: number | Decimal }>;
}): PayrollCalculationResult {
  const basic = roundToCurrency(new Decimal(params.basicSalary));
  if (basic.isNegative()) {
    throw new Error('Basic salary cannot be negative');
  }

  const earningsItems: PayrollCalculationResult['earningsItems'] = [];
  const deductionsItems: PayrollCalculationResult['deductionsItems'] = [];

  // 1. Initial basic salary earning item
  earningsItems.push({
    code: 'BASIC',
    nameEn: 'Basic Salary',
    nameBn: 'মূল বেতন',
    amount: basic,
    type: 'EARNING',
    isTaxable: true,
  });

  let runningGross = basic;

  // 2. Evaluate Allowances & Regular Earnings
  const earningComponents = params.components.filter((c) => c.type === 'EARNING');
  for (const comp of earningComponents) {
    let itemAmount = new Decimal(0);

    if (comp.calculationMethod === 'FIXED') {
      itemAmount = new Decimal(comp.amount);
    } else if (comp.calculationMethod === 'PERCENT_OF_BASIC') {
      const pct = new Decimal(comp.percentageValue || 0);
      itemAmount = basic.mul(pct).div(100);
    } else if (comp.calculationMethod === 'FORMULA' && comp.formulaExpression) {
      itemAmount = evaluateControlledFormula(comp.formulaExpression, {
        BASIC: basic,
        GROSS: runningGross,
      });
    }

    itemAmount = roundToCurrency(itemAmount);
    if (itemAmount.isNegative()) {
      throw new Error(`Earning component "${comp.code}" cannot be negative`);
    }

    earningsItems.push({
      code: comp.code,
      nameEn: comp.nameEn,
      nameBn: comp.nameBn,
      amount: itemAmount,
      type: 'EARNING',
      isTaxable: comp.isTaxable || false,
    });

    runningGross = runningGross.add(itemAmount);
  }

  // 3. Overtime Earnings
  if (params.attendance.overtimeHours > 0) {
    const hourlyRate = params.attendance.overtimeRatePerHour
      ? new Decimal(params.attendance.overtimeRatePerHour)
      : basic.div(params.attendance.totalWorkingDays || 30).div(8); // Default 8 hrs/day
    const otAmount = roundToCurrency(hourlyRate.mul(params.attendance.overtimeHours));

    if (otAmount.greaterThan(0)) {
      earningsItems.push({
        code: 'OVERTIME',
        nameEn: 'Overtime Allowance',
        nameBn: 'অতিরিক্ত কর্মঘণ্টা ভাতা',
        amount: otAmount,
        type: 'EARNING',
        isTaxable: true,
      });
      runningGross = runningGross.add(otAmount);
    }
  }

  // 4. One-time bonuses
  if (params.oneTimeBonuses) {
    for (const b of params.oneTimeBonuses) {
      const bAmt = roundToCurrency(new Decimal(b.amount));
      if (bAmt.isNegative()) throw new Error(`Bonus "${b.code}" cannot be negative`);
      earningsItems.push({
        code: b.code,
        nameEn: b.nameEn,
        nameBn: b.nameBn,
        amount: bAmt,
        type: 'EARNING',
        isTaxable: true,
      });
      runningGross = runningGross.add(bAmt);
    }
  }

  const finalGross = roundToCurrency(runningGross);

  // 5. Evaluate Deductions
  let runningDeductions = new Decimal(0);
  const deductionComponents = params.components.filter((c) => c.type === 'DEDUCTION');
  for (const comp of deductionComponents) {
    let itemAmount = new Decimal(0);

    if (comp.calculationMethod === 'FIXED') {
      itemAmount = new Decimal(comp.amount);
    } else if (comp.calculationMethod === 'PERCENT_OF_BASIC') {
      const pct = new Decimal(comp.percentageValue || 0);
      itemAmount = basic.mul(pct).div(100);
    } else if (comp.calculationMethod === 'PERCENT_OF_GROSS') {
      const pct = new Decimal(comp.percentageValue || 0);
      itemAmount = finalGross.mul(pct).div(100);
    } else if (comp.calculationMethod === 'FORMULA' && comp.formulaExpression) {
      itemAmount = evaluateControlledFormula(comp.formulaExpression, {
        BASIC: basic,
        GROSS: finalGross,
      });
    }

    itemAmount = roundToCurrency(itemAmount);
    if (itemAmount.isNegative()) {
      throw new Error(`Deduction component "${comp.code}" cannot be negative`);
    }

    deductionsItems.push({
      code: comp.code,
      nameEn: comp.nameEn,
      nameBn: comp.nameBn,
      amount: itemAmount,
      type: 'DEDUCTION',
      isTaxable: false,
    });

    runningDeductions = runningDeductions.add(itemAmount);
  }

  // 6. Unpaid Leave Deduction
  if (params.attendance.unpaidLeaveDays > 0) {
    const dailyRate = basic.div(params.attendance.totalWorkingDays || 30);
    const unpaidDeduction = roundToCurrency(dailyRate.mul(params.attendance.unpaidLeaveDays));

    if (unpaidDeduction.greaterThan(0)) {
      deductionsItems.push({
        code: 'UNPAID_LEAVE',
        nameEn: 'Unpaid Leave Deduction',
        nameBn: 'অবৈতনিক ছুটি কর্তন',
        amount: unpaidDeduction,
        type: 'DEDUCTION',
        isTaxable: false,
      });
      runningDeductions = runningDeductions.add(unpaidDeduction);
    }
  }

  // 7. One-time deductions
  if (params.oneTimeDeductions) {
    for (const d of params.oneTimeDeductions) {
      const dAmt = roundToCurrency(new Decimal(d.amount));
      if (dAmt.isNegative()) throw new Error(`Deduction "${d.code}" cannot be negative`);
      deductionsItems.push({
        code: d.code,
        nameEn: d.nameEn,
        nameBn: d.nameBn,
        amount: dAmt,
        type: 'DEDUCTION',
        isTaxable: false,
      });
      runningDeductions = runningDeductions.add(dAmt);
    }
  }

  const finalDeductions = roundToCurrency(runningDeductions);

  // 8. Available net before advance recovery
  let netBeforeAdvance = finalGross.sub(finalDeductions);
  if (netBeforeAdvance.isNegative()) {
    throw new Error(
      `Total deductions (৳${finalDeductions.toFixed(2)}) exceed gross earnings (৳${finalGross.toFixed(2)})`
    );
  }

  // 9. Advance Recovery
  let totalAdvanceRecovery = new Decimal(0);
  const advanceRecoverySnapshots: PayrollCalculationResult['snapshot']['advanceRecoveries'] = [];

  if (params.advances && params.advances.length > 0) {
    for (const adv of params.advances) {
      const balance = roundToCurrency(new Decimal(adv.balanceRemaining));
      if (balance.lessThanOrEqualTo(0)) continue;

      const monthlyScheduled = roundToCurrency(new Decimal(adv.monthlyDeduction));
      // Recovery cannot exceed remaining balance or remaining net salary
      const possibleRecovery = Decimal.min(balance, monthlyScheduled);
      const actualRecovery = Decimal.min(possibleRecovery, netBeforeAdvance);

      if (actualRecovery.greaterThan(0)) {
        totalAdvanceRecovery = totalAdvanceRecovery.add(actualRecovery);
        netBeforeAdvance = netBeforeAdvance.sub(actualRecovery);

        deductionsItems.push({
          code: `ADV_RECOVERY_${adv.advanceNumber}`,
          nameEn: `Advance Recovery (${adv.advanceNumber})`,
          nameBn: `অগ্রিম বেতন কর্তন (${adv.advanceNumber})`,
          amount: actualRecovery,
          type: 'DEDUCTION',
          isTaxable: false,
        });

        advanceRecoverySnapshots.push({
          advanceId: adv.advanceId,
          advanceNumber: adv.advanceNumber,
          recoveredAmount: actualRecovery.toNumber(),
          balanceRemainingAfter: balance.sub(actualRecovery).toNumber(),
        });
      }
    }
  }

  const finalNet = roundToCurrency(finalGross.sub(finalDeductions).sub(totalAdvanceRecovery));

  if (finalNet.isNegative()) {
    throw new Error(`Net salary cannot be negative: computed ৳${finalNet.toFixed(2)}`);
  }

  // 10. Construct immutable calculation snapshot
  const snapshot: PayrollCalculationResult['snapshot'] = {
    calculatedAt: new Date().toISOString(),
    basicSalary: basic.toNumber(),
    grossEarnings: finalGross.toNumber(),
    totalDeductions: finalDeductions.toNumber(),
    advanceRecovery: totalAdvanceRecovery.toNumber(),
    netSalary: finalNet.toNumber(),
    attendance: { ...params.attendance },
    components: [
      ...earningsItems.map((e) => ({
        code: e.code,
        nameEn: e.nameEn,
        nameBn: e.nameBn,
        type: e.type,
        amount: e.amount.toNumber(),
      })),
      ...deductionsItems.map((d) => ({
        code: d.code,
        nameEn: d.nameEn,
        nameBn: d.nameBn,
        type: d.type,
        amount: d.amount.toNumber(),
      })),
    ],
    advanceRecoveries: advanceRecoverySnapshots,
  };

  return {
    basicSalary: basic,
    grossEarnings: finalGross,
    totalDeductions: finalDeductions,
    advanceRecoveryAmount: totalAdvanceRecovery,
    netSalary: finalNet,
    earningsItems,
    deductionsItems,
    snapshot,
  };
}
