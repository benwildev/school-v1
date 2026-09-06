import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { DeviceCreateSchema } from '@/lib/validation/attendance-advanced';
import { encryptCredential, hashApiKey, redactDeviceSecrets } from '@/lib/security/credential-encryption';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_DEVICE_VIEW' });

    return await withTenantContext(schoolId, async (tx) => {
      const devices = await tx.biometricDevice.findMany({
        where: { schoolId },
        include: {
          campus: { select: { id: true, nameEn: true, nameBn: true } },
          _count: { select: { rawEvents: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const safeDevices = devices.map(redactDeviceSecrets);
      return NextResponse.json({ success: true, data: safeDevices });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_DEVICE_CREATE' });

    const body = await request.json();
    const validated = DeviceCreateSchema.parse(body);

    return await withTenantContext(schoolId, async (tx) => {
      // Check serial uniqueness within school
      const existing = await tx.biometricDevice.findUnique({
        where: {
          schoolId_deviceSerial: {
            schoolId,
            deviceSerial: validated.deviceSerial,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: `Device with serial number '${validated.deviceSerial}' already exists in this school.` },
          { status: 409 }
        );
      }

      const credentialsEncrypted = validated.credentials ? encryptCredential(validated.credentials) : null;
      const apiKeyHash = validated.apiKey ? hashApiKey(validated.apiKey) : null;

      const device = await tx.biometricDevice.create({
        data: {
          schoolId,
          campusId: validated.campusId,
          deviceName: validated.deviceName,
          deviceSerial: validated.deviceSerial,
          deviceIp: validated.deviceIp,
          port: validated.port,
          deviceModel: validated.deviceModel,
          deviceType: validated.deviceType,
          provider: validated.provider,
          credentialsEncrypted,
          apiKeyHash,
          location: validated.location,
          status: validated.status,
          settings: validated.settings,
          syncMode: validated.syncMode,
        },
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.fullName,
        actorRole: 'ADMIN',
        action: AuditAction.INSERT,
        entity: 'BiometricDevice',
        entityId: device.id,
        changeSummary: `Registered attendance device: ${device.deviceName} (${device.deviceSerial})`,
        afterState: redactDeviceSecrets(device),
      });

      return NextResponse.json({ success: true, data: redactDeviceSecrets(device) }, { status: 201 });
    });
  } catch (error: any) {
    if (error.name === 'ZodError') return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 });
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
