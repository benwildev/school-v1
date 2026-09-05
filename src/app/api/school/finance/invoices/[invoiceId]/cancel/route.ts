import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { InvoiceCancelSchema } from '@/lib/validation/finance';
import { AuditAction } from '@prisma/client';

/**
 * POST /api/school/finance/invoices/[invoiceId]/cancel
 * Voids a student fee invoice with audit reason
 * Required Permission: FEES_CANCEL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'FEES_CANCEL',
    });
    const { invoiceId } = await params;

    const invoice = await prisma.studentFee.findFirst({
      where: { id: invoiceId, schoolId },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'VOIDED') {
      return NextResponse.json({ error: 'Invoice is already voided' }, { status: 400 });
    }

    if (Number(invoice.paidAmount) > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot cancel an invoice with allocated payments. Please refund or reverse the payments first.',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = InvoiceCancelSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { reason } = parseResult.data;

    const updated = await withTenantContext(schoolId, async (tx) => {
      return tx.studentFee.update({
        where: { id: invoiceId },
        data: {
          status: 'VOIDED',
          voidReason: reason,
          voidedById: context.userId,
          voidedAt: new Date(),
        },
      });
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || 'Staff',
      actorRole: 'ADMIN',
      action: AuditAction.UPDATE,
      entity: 'StudentFee',
      entityId: invoiceId,
      beforeState: invoice,
      afterState: updated,
      changeSummary: `Voided invoice ${invoice.invoiceNumber}. Reason: ${reason}`,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.status) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
