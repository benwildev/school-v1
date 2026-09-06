import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { DeviceUpdateSchema } from '@/lib/validation/attendance-advanced';
import { encryptCredential, hashApiKey, redactDeviceSecrets } from '@/lib/security/credential-encryption';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const { schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_DEVICE_VIEW' });

    return await withTenantContext(schoolId, async (tx) => {
      const device = await tx.biometricDevice.findFirst({
        where: { id: deviceId, schoolId },
        include: {
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          _count: { select: { rawEvents: true } },
        },
      });

      if (!device) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data: redactDeviceSecrets(device) });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_DEVICE_UPDATE' });

    const body = await request.json();
    const validated = DeviceUpdateSchema.parse(body);

    return await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.biometricDevice.findFirst({
        where: { id: deviceId, schoolId },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }

      const updateData: any = { ...validated };
      if (validated.credentials !== undefined) {
        updateData.credentialsEncrypted = validated.credentials ? encryptCredential(validated.credentials) : null;
        delete updateData.credentials;
      }
      if (validated.apiKey !== undefined) {
        updateData.apiKeyHash = validated.apiKey ? hashApiKey(validated.apiKey) : null;
        delete updateData.apiKey;
      }

      const updated = await tx.biometricDevice.update({
        where: { id: deviceId },
        data: updateData,
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.fullName,
        actorRole: 'ADMIN',
        action: AuditAction.UPDATE,
        entity: 'BiometricDevice',
        entityId: deviceId,
        changeSummary: `Updated attendance device: ${updated.deviceName}`,
        beforeState: redactDeviceSecrets(existing),
        afterState: redactDeviceSecrets(updated),
      });

      return NextResponse.json({ success: true, data: redactDeviceSecrets(updated) });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_DEVICE_UPDATE' });

    return await withTenantContext(schoolId, async (tx) => {
      const existing = await tx.biometricDevice.findFirst({
        where: { id: deviceId, schoolId },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }

      await tx.biometricDevice.delete({
        where: { id: deviceId },
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.fullName,
        actorRole: 'ADMIN',
        action: AuditAction.DELETE,
        entity: 'BiometricDevice',
        entityId: deviceId,
        changeSummary: `Deleted attendance device: ${existing.deviceName} (${existing.deviceSerial})`,
        beforeState: redactDeviceSecrets(existing),
      });

      return NextResponse.json({ success: true, message: 'Device deleted successfully' });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
