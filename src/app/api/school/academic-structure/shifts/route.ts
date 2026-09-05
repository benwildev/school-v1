import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authorize } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { ShiftConfigUpdateSchema, ShiftItemConfig } from '@/lib/validation/academic-structure';
import { AcademicShift } from '@prisma/client';

const CANONICAL_SHIFTS: Array<{
  shift: AcademicShift;
  nameEn: string;
  nameBn: string;
  defaultStartTime: string;
  defaultEndTime: string;
}> = [
  {
    shift: 'MORNING',
    nameEn: 'Morning Shift',
    nameBn: 'প্রভাতী / মর্নিং শিফট',
    defaultStartTime: '07:30',
    defaultEndTime: '11:30',
  },
  {
    shift: 'DAY',
    nameEn: 'Day Shift',
    nameBn: 'দিবা / ডে শিফট',
    defaultStartTime: '11:45',
    defaultEndTime: '16:30',
  },
  {
    shift: 'EVENING',
    nameEn: 'Evening Shift',
    nameBn: 'সান্ধ্য / ইভনিং শিফট',
    defaultStartTime: '16:45',
    defaultEndTime: '20:30',
  },
];

/**
 * GET /api/school/academic-structure/shifts
 * Lists the academic shifts supported by the institution along with section counts and time configs.
 *
 * Required Permission: ACADEMICS_VIEW
 */
export async function GET(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_VIEW',
    });

    const data = await withTenantContext(schoolId, async (tx) => {
      // Get section counts grouped by shift
      const sectionCounts = await tx.section.groupBy({
        by: ['shift'],
        where: { schoolId },
        _count: {
          id: true,
        },
      });

      const countMap = new Map<string, number>();
      for (const item of sectionCounts) {
        countMap.set(item.shift, item._count.id);
      }

      // Get customized settings from school_settings
      const settings = await tx.schoolSettings.findUnique({
        where: { schoolId },
        select: { customAttributes: true },
      });

      const customAttrs = (settings?.customAttributes || {}) as Record<string, unknown>;
      const configuredShifts = (customAttrs.supportedShifts || []) as ShiftItemConfig[];

      return CANONICAL_SHIFTS.map((canonical) => {
        const custom = configuredShifts.find((s) => s.shift === canonical.shift);
        return {
          shift: canonical.shift,
          nameEn: canonical.nameEn,
          nameBn: custom?.labelBn || canonical.nameBn,
          isEnabled: custom?.isEnabled !== undefined ? custom.isEnabled : true,
          startTime: custom?.startTime || canonical.defaultStartTime,
          endTime: custom?.endTime || canonical.defaultEndTime,
          sectionCount: countMap.get(canonical.shift) || 0,
        };
      });
    });

    const updateCheck = await authorize({
      userId: context.userId,
      schoolId,
      permission: 'ACADEMICS_UPDATE',
    });

    return NextResponse.json({
      success: true,
      data,
      canUpdate: updateCheck.authorized,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/academic-structure/shifts error:', error);
    return NextResponse.json(
      { success: false, error: 'শিফট তালিকা লোড করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/academic-structure/shifts
 * Updates institution-level shift configurations in SchoolSettings.
 *
 * Required Permission: ACADEMICS_UPDATE
 */
export async function PATCH(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'ACADEMICS_UPDATE',
    });

    const bodyJson = await req.json();
    const parseResult = ShiftConfigUpdateSchema.safeParse(bodyJson);

    if (!parseResult.success) {
      const issueMessages = parseResult.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed: ' + issueMessages,
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const result = await withTenantContext(schoolId, async (tx) => {
      const settings = await tx.schoolSettings.findUnique({
        where: { schoolId },
      });

      const currentAttrs = (settings?.customAttributes || {}) as Record<string, unknown>;
      const newAttrs = {
        ...currentAttrs,
        supportedShifts: input.shifts,
      };

      if (settings) {
        const updated = await tx.schoolSettings.update({
          where: { schoolId },
          data: { customAttributes: newAttrs },
        });
        return { before: currentAttrs, after: updated.customAttributes };
      } else {
        const created = await tx.schoolSettings.create({
          data: {
            schoolId,
            customAttributes: newAttrs,
          },
        });
        return { before: null, after: created.customAttributes };
      }
    });

    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.phone || context.user.fullName || 'User',
      actorRole: 'ADMIN',
      action: 'UPDATE',
      entity: 'SchoolSettings',
      entityId: schoolId,
      beforeState: result.before as Record<string, unknown>,
      afterState: result.after as Record<string, unknown>,
      changeSummary: 'Updated academic shifts configuration',
      ipAddress: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: 'শিফট কনফিগারেশন সফলভাবে সংরক্ষিত হয়েছে।',
      data: input.shifts,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('PATCH /api/school/academic-structure/shifts error:', error);
    return NextResponse.json(
      { success: false, error: 'শিফট কনফিগারেশন আপডেট করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
