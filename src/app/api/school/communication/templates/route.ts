import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import {
  NotificationTemplateCreateSchema,
  NotificationTemplateUpdateSchema,
} from '@/lib/validation/communication';
import { extractTemplateVariables } from '@/lib/communication/template-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'COMMUNICATION_TEMPLATE_VIEW' });

    return await withTenantContext(schoolId, async () => {
      const templates = await prisma.notificationTemplate.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
      });

      return NextResponse.json({ success: true, data: templates });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'COMMUNICATION_TEMPLATE_CREATE' });

    const body = await request.json();
    const validated = NotificationTemplateCreateSchema.parse(body);

    return await withTenantContext(schoolId, async () => {
      const existing = await prisma.notificationTemplate.findUnique({
        where: {
          schoolId_code: {
            schoolId,
            code: validated.code,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: `Notification template with code '${validated.code}' already exists in this school.` },
          { status: 409 }
        );
      }

      // Automatically discover template variables from both English and Bangla templates
      const varsEn = extractTemplateVariables(validated.templateEn);
      const varsBn = extractTemplateVariables(validated.templateBn);
      const combinedVars = Array.from(new Set([...validated.variables, ...varsEn, ...varsBn]));

      const template = await prisma.notificationTemplate.create({
        data: {
          schoolId,
          name: validated.name,
          code: validated.code,
          channel: validated.channel,
          templateEn: validated.templateEn,
          templateBn: validated.templateBn,
          variables: combinedVars,
          status: validated.status,
        },
      });

      return NextResponse.json({ success: true, data: template }, { status: 201 });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'COMMUNICATION_TEMPLATE_UPDATE' });

    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required for update' }, { status: 400 });
    }

    const validated = NotificationTemplateUpdateSchema.parse(updateFields);

    return await withTenantContext(schoolId, async () => {
      const existing = await prisma.notificationTemplate.findFirst({
        where: { id, schoolId },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      const updated = await prisma.notificationTemplate.update({
        where: { id },
        data: validated,
      });

      return NextResponse.json({ success: true, data: updated });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
