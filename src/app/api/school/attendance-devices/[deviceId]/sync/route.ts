import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { AuditAction } from '@prisma/client';
import { decryptCredential, redactDeviceSecrets } from '@/lib/security/credential-encryption';
import { AttendanceAdapterRegistry } from '@/lib/attendance/device-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await params;
    const { context, schoolId } = await requirePermission(request, { permission: 'ATTENDANCE_DEVICE_SYNC' });

    return await withTenantContext(schoolId, async (tx) => {
      const device = await tx.biometricDevice.findFirst({
        where: { id: deviceId, schoolId },
      });

      if (!device) {
        return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      }

      const adapter = AttendanceAdapterRegistry.getAdapter(device.provider);

      let credentialsDecrypted = '';
      if (device.credentialsEncrypted) {
        try {
          credentialsDecrypted = decryptCredential(device.credentialsEncrypted);
        } catch {
          // Keep empty if decryption fails
        }
      }

      // Test connection or perform sync check via adapter
      const connectionTest = await adapter.testConnection({
        deviceIp: device.deviceIp || undefined,
        port: device.port || undefined,
        serialNumber: device.deviceSerial,
        credentialsDecrypted,
        settings: (device.settings as Record<string, any>) || {},
      });

      const updated = await tx.biometricDevice.update({
        where: { id: deviceId },
        data: {
          lastSyncAt: new Date(),
          lastHeartbeatAt: new Date(),
          status: connectionTest.success ? 'ONLINE' : 'OFFLINE',
        },
      });

      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.fullName,
        actorRole: 'ADMIN',
        action: AuditAction.UPDATE,
        entity: 'BiometricDevice',
        entityId: deviceId,
        changeSummary: `Device sync triggered: ${device.deviceName} (${connectionTest.success ? 'ONLINE' : 'OFFLINE'})`,
        afterState: {
          ...redactDeviceSecrets(updated),
          syncResult: connectionTest,
        },
      });

      return NextResponse.json({
        success: connectionTest.success,
        data: {
          device: redactDeviceSecrets(updated),
          connection: connectionTest,
          syncedAt: updated.lastSyncAt,
        },
      });
    });
  } catch (error: any) {
    if (error.message?.startsWith('UNAUTHORIZED')) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error.message?.startsWith('FORBIDDEN')) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
