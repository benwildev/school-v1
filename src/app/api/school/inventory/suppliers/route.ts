import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateSupplierSchema } from '@/lib/validation/inventory';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'SUPPLIER_VIEW' });

    const suppliers = await withTenantContext(schoolId, async (tx) => {
      return tx.inventorySupplier.findMany({
        where: { schoolId },
        include: {
          _count: { select: { purchases: true } },
        },
        orderBy: { name: 'asc' },
      });
    });

    return NextResponse.json({ success: true, data: suppliers });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'SUPPLIER_CREATE' });

    const body = await request.json();
    const parsed = CreateSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { supplierCode, name, companyName, contactPerson, phone, email, address } = parsed.data;

    const supplier = await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.inventorySupplier.findFirst({
        where: { schoolId, supplierCode },
      });
      if (existing) {
        throw new Error(`Supplier code "${supplierCode}" already exists.`);
      }

      return tx.inventorySupplier.create({
        data: {
          schoolId,
          supplierCode,
          name,
          companyName: companyName || null,
          contactPerson: contactPerson || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
        },
      });
    });

    return NextResponse.json({ success: true, data: supplier }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
